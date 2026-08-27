import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import {
  isValidDiscordWebhookUrl,
  readDiscordConfig,
  sanitizeDiscordConfigForClient,
  writeDiscordConfig,
} from "../../_shared/discord-config.js";

/**
 * Retrieves the Discord configuration for an authenticated administrator.
 *
 * @param context - The request context containing the incoming request and environment bindings
 * @returns A response containing the sanitized Discord configuration or an authentication error response
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const config = await readDiscordConfig(env);
  return jsonResponse({ ok: true, config: sanitizeDiscordConfigForClient(config) });
}

/**
 * Updates the Discord webhook configuration for an authenticated master admin.
 *
 * @returns A JSON response containing the saved configuration, or an error response for authentication, authorization, validation, or persistence failures.
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

  if (typeof body.webhookUrl !== "string") {
    return jsonResponse({ error: "webhookUrl is required" }, 400);
  }

  const webhookUrl = body.webhookUrl.trim();
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    return jsonResponse({ error: "Invalid Discord webhook URL" }, 400);
  }

  const next = {
    webhookUrl,
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
