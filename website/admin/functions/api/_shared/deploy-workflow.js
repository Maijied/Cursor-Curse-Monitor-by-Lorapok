import { GITHUB_REPO, jsonResponse, mapPublishMarket, mapReleaseChannel } from "./auth.js";
import { validateMarketplaceDeploy } from "./marketplace-tag-policy.js";
import { activateConversationRecoveryNotice, activateRollbackNotice } from "./notices.js";
import { notifyDiscordDeployment } from "./discord-notify.js";
import { scheduleDiscordDeploymentCompletionWatch } from "./discord-deployment-watch.js";
import { fetchSiteData, liveTagFromSiteData } from "./site-data.js";

const WORKFLOW_ID = "ci-cd.yml";
const ACTION_PUBLISH_TAG = "publish-tag - Publish existing git tag to marketplaces";
const ACTION_ROLLBACK = "rollback - Restore previous tag as a new version";
const ACTION_DEPLOY_INFRA = "deploy-infra - Deploy Mission Control admin & marketing site";
const ACTION_FULL_RELEASE = "full-release - Bump version, tag & update Mission Control";

/**
 * Dispatch a GitHub Actions workflow on the main branch.
 * @param {object} env - Environment variables containing the GitHub token.
 * @param {string} workflowId - GitHub Actions workflow identifier.
 * @param {object} inputs - Inputs passed to the workflow.
 * @param {string} successMessage - Message included in the successful response.
 * @param {object} fields - Additional fields included in the successful response.
 * @param {object} [notifyContext] - Context for deployment notifications.
 * @param {object} [pagesContext] - Context used to schedule completion monitoring.
 * @return {Response} A success response or an error response when dispatch fails.
 */
async function dispatchWorkflow(env, workflowId, inputs, successMessage, fields, notifyContext, pagesContext) {
  const githubToken = env.GITHUB_TOKEN;
  if (!githubToken) {
    return jsonResponse(
      {
        error:
          "GITHUB_TOKEN is not configured on Mission Control. Add it in Cloudflare Pages → Settings → Environment variables, then redeploy the admin panel.",
        code: "missing_github_token",
      },
      500
    );
  }

  const githubRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "Cloudflare-Pages",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs }),
    }
  );

  if (!githubRes.ok) {
    const errText = await githubRes.text();
    let detail = errText;
    try {
      const parsed = JSON.parse(errText);
      detail = parsed.message ?? errText;
    } catch {
      // keep raw text
    }
    console.error(`GitHub workflow dispatch failed (${workflowId})`, githubRes.status, errText);
    return jsonResponse(
      {
        error: `GitHub workflow dispatch failed (${githubRes.status}): ${detail}`,
        code: "github_dispatch_failed",
        status: githubRes.status,
      },
      502
    );
  }

  if (notifyContext) {
    notifyDiscordDeployment(env, {
      phase: "started",
      actionType: inputs.action_type,
      tag: inputs.target_tag ?? notifyContext.tag ?? null,
      channel: inputs.release_channel ?? null,
      market: inputs.publish_market ?? null,
      triggeredBy: notifyContext.triggeredBy ?? null,
      branch: "main",
      summary: successMessage,
      runUrl: notifyContext.runUrl ?? null,
    }).catch((error) => {
      console.error("Discord started notification failed", error);
    });

    scheduleDiscordDeploymentCompletionWatch(pagesContext, env, {
      actionType: inputs.action_type,
      tag: inputs.target_tag ?? notifyContext.tag ?? null,
      channel: inputs.release_channel ?? null,
      market: inputs.publish_market ?? null,
      triggeredBy: notifyContext.triggeredBy ?? null,
      dispatchedAt: Date.now(),
      workflowName: workflowId,
      rollbackSourceTag: notifyContext?.rollbackSourceTag ?? null,
      deployAdmin: inputs.deploy_admin === "true",
      deployWebsite: inputs.deploy_website !== "false",
    });
  }

  return jsonResponse({
    success: true,
    message: successMessage,
    workflow: workflowId,
    ...fields,
  });
}

function parseInputs(body) {
  const targetTag = body.target_tag ?? body.tag;
  const publishMarket = mapPublishMarket(body.publish_market ?? body.market);
  const releaseChannel = mapReleaseChannel(body.release_channel ?? body.channel);

  if (!targetTag) {
    return { error: jsonResponse({ error: "target_tag is required" }, 400) };
  }
  if (!publishMarket) {
    return { error: jsonResponse({ error: "Invalid publish_market" }, 400) };
  }
  if (!releaseChannel) {
    return { error: jsonResponse({ error: "Invalid release_channel" }, 400) };
  }

  return { targetTag: String(targetTag), publishMarket, releaseChannel };
}

/**
 * Dispatches a marketplace publish workflow for an existing tag.
 * @param {Record<string, unknown>} env - Runtime environment containing workflow configuration and credentials.
 * @param {Record<string, unknown>} body - Request data containing the target tag, market, release channel, and deployment flags.
 * @param {string} successMessage - Message included in a successful response.
 * @param {Record<string, unknown>} [notifyContext] - Optional context for deployment notifications.
 * @param {Record<string, unknown>} [pagesContext] - Optional context for completion monitoring.
 * @return {Promise<Response>} The workflow dispatch response.
 */
export async function dispatchPublishWorkflow(env, body, successMessage, notifyContext, pagesContext) {
  const parsed = parseInputs(body);
  if (parsed.error) return parsed.error;

  const { targetTag, publishMarket, releaseChannel } = parsed;
  const policy = validateMarketplaceDeploy({ targetTag, releaseChannel, publishMarket });
  if (!policy.ok) {
    return jsonResponse({ error: policy.error }, 400);
  }

  const deployAdmin = body.deploy_admin === true || body.deploy_admin === "true";
  const deployWebsite = body.deploy_website !== false && body.deploy_website !== "false";

  let rollbackSourceTag = notifyContext?.rollbackSourceTag ?? null;
  if (!rollbackSourceTag) {
    try {
      rollbackSourceTag = liveTagFromSiteData(await fetchSiteData(env));
    } catch {
      /* optional */
    }
  }

  return dispatchWorkflow(
    env,
    WORKFLOW_ID,
    {
      action_type: ACTION_PUBLISH_TAG,
      target_tag: targetTag,
      publish_market: publishMarket,
      release_channel: releaseChannel,
      deploy_admin: deployAdmin ? "true" : "false",
      deploy_website: deployWebsite ? "true" : "false",
    },
    successMessage,
    { target_tag: targetTag, publish_market: publishMarket, release_channel: releaseChannel },
    { ...notifyContext, tag: targetTag, rollbackSourceTag, deployAdmin, deployWebsite },
    pagesContext
  );
}

/**
 * Dispatch a rollback workflow and activate the public recovery notice.
 * @param {Record<string, unknown>} body - Contains the target tag, publishing market, and release channel.
 * @param {Record<string, unknown>} notifyContext - Optional context for deployment notifications.
 * @param {Record<string, unknown>} pagesContext - Optional context for Pages deployment monitoring.
 * @returns {Response} The workflow dispatch or error response.
 */
export async function dispatchRollbackWorkflow(env, body, successMessage, notifyContext, pagesContext) {
  const parsed = parseInputs(body);
  if (parsed.error) return parsed.error;

  const { targetTag, publishMarket, releaseChannel } = parsed;
  const policy = validateMarketplaceDeploy({ targetTag, releaseChannel, publishMarket });
  if (!policy.ok) {
    return jsonResponse({ error: policy.error }, 400);
  }

  const response = await dispatchWorkflow(
    env,
    WORKFLOW_ID,
    {
      action_type: ACTION_ROLLBACK,
      target_tag: targetTag,
      publish_market: publishMarket,
      release_channel: releaseChannel,
    },
    successMessage,
    { target_tag: targetTag, publish_market: publishMarket, release_channel: releaseChannel },
    notifyContext,
    pagesContext
  );

  if (!response.ok) return response;

  try {
    const payload = await response.json();
    const notice = await activateRollbackNotice(env);
    return jsonResponse({ ...payload, notice }, response.status);
  } catch (error) {
    console.error("Rollback dispatched but public recovery notice could not be activated", error);
    return jsonResponse(
      {
        error: "Rollback was dispatched, but the public recovery notice could not be activated. Contact an administrator immediately.",
      },
      502
    );
  }
}

/** @deprecated Use dispatchPublishWorkflow or dispatchRollbackWorkflow */
export async function dispatchDeploymentWorkflow(env, body, successMessage) {
  return dispatchRollbackWorkflow(env, body, successMessage);
}

const VERSION_TYPE_INPUTS = {
  patch: "patch - Bug fix or Feature update (e.g. v0.7.1, v0.7.2)",
  minor: "minor - New Feature (e.g. v0.8.0)",
  major: "major - Production / Breaking (e.g. v1.0.0)",
  custom: "custom - Specify exact version below",
};

/**
 * Dispatch an infrastructure-only deployment workflow for the admin and marketing sites.
 * @param {Record<string, unknown>} env - The deployment environment configuration.
 * @param {Record<string, unknown>} body - Deployment options, including site deployment flags.
 * @param {string} successMessage - The message returned when dispatch succeeds.
 * @param {unknown} notifyContext - Optional notification context.
 * @param {unknown} pagesContext - Optional Pages deployment context.
 */
export async function dispatchInfraWorkflow(env, body, successMessage, notifyContext, pagesContext) {
  const deployAdmin = bodyFlag(body, "deploy_admin", true);
  const deployWebsite = bodyFlag(body, "deploy_website", true);
  return dispatchWorkflow(
    env,
    WORKFLOW_ID,
    {
      action_type: ACTION_DEPLOY_INFRA,
      publish_market: "Open VSX + Firefox AMO",
      release_channel: "Production",
      deploy_admin: deployAdmin ? "true" : "false",
      deploy_website: deployWebsite ? "true" : "false",
    },
    successMessage,
    { deploy_admin: deployAdmin, deploy_website: deployWebsite },
    notifyContext,
    pagesContext
  );
}

function bodyFlag(body, key, defaultValue) {
  if (!body || body[key] === undefined) return defaultValue;
  if (body[key] === false || body[key] === "false") return false;
  return true;
}

/**
 * Dispatch a full release workflow using the requested version, market, and release channel.
 * @param {Record<string, unknown>} body - Release settings, including version and deployment options.
 * @param {string} successMessage - Message included in the successful response.
 * @returns {Response} The workflow dispatch response, or an error response for invalid settings or notice activation failure.
 */
export async function dispatchReleaseWorkflow(env, body, successMessage, notifyContext, pagesContext) {
  const publishMarket = mapPublishMarket(body.publish_market ?? body.market);
  const releaseChannel = mapReleaseChannel(body.release_channel ?? body.channel);
  const bumpKey = String(body.version_type ?? body.bump_type ?? "patch");
  if (!(bumpKey in VERSION_TYPE_INPUTS)) {
    return jsonResponse({ error: "Invalid version_type" }, 400);
  }
  const versionTypeInput = VERSION_TYPE_INPUTS[bumpKey];
  const customVersion = String(body.custom_version ?? "").trim();

  if (!publishMarket) {
    return jsonResponse({ error: "Invalid publish_market" }, 400);
  }
  if (!releaseChannel) {
    return jsonResponse({ error: "Invalid release_channel" }, 400);
  }
  if (versionTypeInput.startsWith("custom") && !customVersion) {
    return jsonResponse({ error: "custom_version is required for custom releases" }, 400);
  }

  const deployAdmin = bodyFlag(body, "deploy_admin", true);
  const deployWebsite = bodyFlag(body, "deploy_website", true);

  const response = await dispatchWorkflow(
    env,
    WORKFLOW_ID,
    {
      action_type: ACTION_FULL_RELEASE,
      version_type: versionTypeInput,
      custom_version: customVersion,
      publish_market: publishMarket,
      release_channel: releaseChannel,
      deploy_admin: deployAdmin ? "true" : "false",
      deploy_website: deployWebsite ? "true" : "false",
    },
    successMessage,
    {
      version_type: bumpKey,
      custom_version: customVersion,
      publish_market: publishMarket,
      release_channel: releaseChannel,
    },
    notifyContext,
    pagesContext
  );

  if (!response.ok) return response;

  const activateRecovery =
    body.activate_recovery_notice === true ||
    body.activate_recovery_notice === "true" ||
    body.feature_notice === "conversation-recovery";

  if (!activateRecovery) return response;

  try {
    const payload = await response.json();
    const notice = await activateConversationRecoveryNotice(env);
    return jsonResponse({ ...payload, notice }, response.status);
  } catch (error) {
    console.error("Release dispatched but conversation recovery notice could not be activated", error);
    return jsonResponse(
      {
        error:
          "Release was dispatched, but the conversation recovery notice could not be activated. Enable it manually from Mission Control → Notices.",
      },
      502
    );
  }
}
