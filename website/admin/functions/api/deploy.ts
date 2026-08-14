import {
  GITHUB_REPO,
  jsonResponse,
  mapPublishMarket,
  mapReleaseChannel,
  verifyAdminRequest,
} from "./_shared/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const targetTag = body.target_tag ?? body.tag;
    const publishMarket = mapPublishMarket(body.publish_market ?? body.market);
    const releaseChannel = mapReleaseChannel(body.release_channel ?? body.channel);

    if (!targetTag) {
      return jsonResponse({ error: "target_tag is required" }, 400);
    }
    if (!publishMarket) {
      return jsonResponse({ error: "Invalid publish_market" }, 400);
    }
    if (!releaseChannel) {
      return jsonResponse({ error: "Invalid release_channel" }, 400);
    }

    const githubToken = env.GITHUB_TOKEN;
    if (!githubToken) {
      return jsonResponse({ error: "GitHub Token not configured on server" }, 500);
    }

    const workflowId = "deployment.yml";
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
        body: JSON.stringify({
          ref: "main",
          inputs: {
            target_tag: targetTag,
            publish_market: publishMarket,
            release_channel: releaseChannel,
          },
        }),
      }
    );

    if (!githubRes.ok) {
      console.error("GitHub deploy dispatch failed", githubRes.status, await githubRes.text());
      return jsonResponse({ error: "Failed to trigger deployment workflow" }, 502);
    }

    return jsonResponse({
      success: true,
      message: "Deployment triggered successfully",
      target_tag: targetTag,
      publish_market: publishMarket,
      release_channel: releaseChannel,
    });
  } catch (err) {
    console.error("Deploy handler error", err);
    return jsonResponse({ error: "Server error" }, 500);
  }
}
