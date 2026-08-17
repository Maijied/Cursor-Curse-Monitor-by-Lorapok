import { GITHUB_REPO, jsonResponse, mapPublishMarket, mapReleaseChannel } from "./auth.js";

const MIN_PUBLISH_TAG = "v0.5.5";

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
    "publish-tag.yml",
    {
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

  return dispatchWorkflow(
    env,
    "deployment.yml",
    {
      target_tag: targetTag,
      publish_market: publishMarket,
      release_channel: releaseChannel,
    },
    successMessage,
    { target_tag: targetTag, publish_market: publishMarket, release_channel: releaseChannel }
  );
}

/** @deprecated Use dispatchPublishWorkflow or dispatchRollbackWorkflow */
export async function dispatchDeploymentWorkflow(env, body, successMessage) {
  return dispatchRollbackWorkflow(env, body, successMessage);
}
