import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  isValidDiscordWebhookUrl,
  isValidDiscordInviteUrl,
  DEFAULT_COMMUNITY_INVITE_URL,
  readDiscordConfig,
  sanitizeDiscordConfigForClient,
  writeDiscordConfig,
} from "../../_shared/discord-config.js";

/**
 * Retrieves the Discord configuration for an authenticated administrator.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readDiscordConfig(env);
  return jsonResponse({ ok: true, config: sanitizeDiscordConfigForClient(config) });
}

/**
 * Updates deployment and/or feedback Discord webhook URLs for master administrators.
 *
 * The deployment webhook accepts `deploymentWebhookUrl` or the legacy `webhookUrl` field.
 *
 * @returns An HTTP response containing the updated configuration or an error.
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const current = await readDiscordConfig(env);
  let deploymentWebhookUrl = current.deploymentWebhookUrl;
  let feedbackWebhookUrl = current.feedbackWebhookUrl;
  let communityWebhookUrl = current.communityWebhookUrl;

  if (body.deploymentWebhookUrl !== undefined || body.webhookUrl !== undefined) {
    deploymentWebhookUrl = String(body.deploymentWebhookUrl ?? body.webhookUrl ?? "").trim();
    if (!isValidDiscordWebhookUrl(deploymentWebhookUrl)) {
      return jsonResponse({ error: "Invalid deployment Discord webhook URL" }, 400);
    }
  }

  if (body.feedbackWebhookUrl !== undefined) {
    feedbackWebhookUrl = String(body.feedbackWebhookUrl ?? "").trim();
    if (feedbackWebhookUrl && !isValidDiscordWebhookUrl(feedbackWebhookUrl)) {
      return jsonResponse({ error: "Invalid feedback Discord webhook URL" }, 400);
    }
  }

  if (body.communityWebhookUrl !== undefined) {
    communityWebhookUrl = String(body.communityWebhookUrl ?? "").trim();
    if (communityWebhookUrl && !isValidDiscordWebhookUrl(communityWebhookUrl)) {
      return jsonResponse({ error: "Invalid community Discord webhook URL" }, 400);
    }
  }

  let communityInviteUrl = current.communityInviteUrl;
  if (body.communityInviteUrl !== undefined) {
    communityInviteUrl = String(body.communityInviteUrl ?? "").trim();
    if (!communityInviteUrl) {
      communityInviteUrl = DEFAULT_COMMUNITY_INVITE_URL;
    } else if (!isValidDiscordInviteUrl(communityInviteUrl)) {
      return jsonResponse({ error: "Invalid community Discord invite URL" }, 400);
    }
  }

  if (
    body.deploymentWebhookUrl === undefined &&
    body.webhookUrl === undefined &&
    body.feedbackWebhookUrl === undefined &&
    body.communityWebhookUrl === undefined &&
    body.communityInviteUrl === undefined
  ) {
    return jsonResponse(
      { error: "deploymentWebhookUrl, feedbackWebhookUrl, communityWebhookUrl, or communityInviteUrl is required" },
      400
    );
  }

  const next = {
    deploymentWebhookUrl,
    feedbackWebhookUrl,
    communityWebhookUrl,
    communityInviteUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.email,
  };

  try {
    await writeDiscordConfig(env, next);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  return jsonResponse({ ok: true, config: sanitizeDiscordConfigForClient(next) });
}
