import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import {
  isValidDiscordWebhookUrl,
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
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const current = await readDiscordConfig(env);
  let deploymentWebhookUrl = current.deploymentWebhookUrl;
  let feedbackWebhookUrl = current.feedbackWebhookUrl;

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

  if (
    body.deploymentWebhookUrl === undefined &&
    body.webhookUrl === undefined &&
    body.feedbackWebhookUrl === undefined
  ) {
    return jsonResponse(
      { error: "deploymentWebhookUrl or feedbackWebhookUrl is required" },
      400
    );
  }

  const next = {
    deploymentWebhookUrl,
    feedbackWebhookUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.email,
  };

  try {
    await writeDiscordConfig(env, next);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Save failed" }, 503);
  }

  return jsonResponse({ ok: true, config: sanitizeDiscordConfigForClient(next) });
}
