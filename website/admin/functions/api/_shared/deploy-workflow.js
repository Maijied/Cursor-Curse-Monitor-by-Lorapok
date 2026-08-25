import { GITHUB_REPO, jsonResponse, mapPublishMarket, mapReleaseChannel } from "./auth.js";
import { activateConversationRecoveryNotice, activateRollbackNotice } from "./notices.js";

const MIN_PUBLISH_TAG = "v0.5.5";
const WORKFLOW_ID = "ci-cd.yml";
const ACTION_PUBLISH_TAG = "publish-tag - Publish existing git tag to marketplaces";
const ACTION_ROLLBACK = "rollback - Restore previous tag as a new version";
const ACTION_FULL_RELEASE = "full-release - Bump version & publish all channels";

async function dispatchWorkflow(env, workflowId, inputs, successMessage, fields) {
  const githubToken = env.GITHUB_TOKEN;
  if (!githubToken) {
    return jsonResponse({ error: "GitHub Token not configured on server" }, 500);
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
    console.error(`GitHub workflow dispatch failed (${workflowId})`, githubRes.status, await githubRes.text());
    return jsonResponse({ error: "Failed to trigger deployment workflow" }, 502);
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

function tagAtLeast(tag, minimum) {
  const normalize = (value) =>
    String(value)
      .replace(/^v/i, "")
      .split("-")[0]
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);

  const [aMaj, aMin, aPatch] = normalize(tag);
  const [bMaj, bMin, bPatch] = normalize(minimum);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPatch >= bPatch;
}

/**
 * Forward publish — existing tag, no main rewrite.
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} body
 * @param {string} successMessage
 */
export async function dispatchPublishWorkflow(env, body, successMessage) {
  const parsed = parseInputs(body);
  if (parsed.error) return parsed.error;

  const { targetTag, publishMarket, releaseChannel } = parsed;
  if (!tagAtLeast(targetTag, MIN_PUBLISH_TAG)) {
    return jsonResponse(
      {
        error: `Tag ${targetTag} is too old for marketplace publish. Choose ${MIN_PUBLISH_TAG} or newer.`,
      },
      400
    );
  }

  return dispatchWorkflow(
    env,
    WORKFLOW_ID,
    {
      action_type: ACTION_PUBLISH_TAG,
      target_tag: targetTag,
      publish_market: publishMarket,
      release_channel: releaseChannel,
    },
    successMessage,
    { target_tag: targetTag, publish_market: publishMarket, release_channel: releaseChannel }
  );
}

/**
 * Rollback — restore a prior tag to main and publish a bumped patch release.
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} body
 * @param {string} successMessage
 */
export async function dispatchRollbackWorkflow(env, body, successMessage) {
  const parsed = parseInputs(body);
  if (parsed.error) return parsed.error;

  const { targetTag, publishMarket, releaseChannel } = parsed;
  if (!tagAtLeast(targetTag, MIN_PUBLISH_TAG)) {
    return jsonResponse(
      {
        error: `Tag ${targetTag} cannot be rolled back safely. Choose ${MIN_PUBLISH_TAG} or newer.`,
      },
      400
    );
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
    { target_tag: targetTag, publish_market: publishMarket, release_channel: releaseChannel }
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
 * New release — bump package.json, create tag, publish via ci-cd.yml.
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} body
 * @param {string} successMessage
 */
export async function dispatchReleaseWorkflow(env, body, successMessage) {
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

  const deployAdmin = body.deploy_admin !== false && body.deploy_admin !== "false";
  const deployWebsite = body.deploy_website !== false && body.deploy_website !== "false";

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
    }
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
