import { jsonResponse, verifyAdminRequest } from "../_shared/auth.js";
import {
  DEFAULT_DISCORD_CONFIG,
  isValidDiscordWebhookUrl,
  readDiscordConfig,
  sanitizeDiscordConfigForClient,
  writeDiscordConfig,
} from "../_shared/discord-config.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const config = await readDiscordConfig(env);
  return jsonResponse({ ok: true, config: sanitizeDiscordConfigForClient(config) });
}

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

  let webhookUrl = current.webhookUrl;
  if (typeof body.webhookUrl === "string") {
    const trimmed = body.webhookUrl.trim();
    if (trimmed && !isValidDiscordWebhookUrl(trimmed)) {
      return jsonResponse({ error: "Invalid Discord webhook URL" }, 400);
    }
    webhookUrl = trimmed;
  }

  const events = { ...DEFAULT_DISCORD_CONFIG.events, ...(current.events ?? {}) };
  if (body.events && typeof body.events === "object") {
    for (const key of ["started", "completed", "failed", "pushed"]) {
      if (typeof body.events[key] === "boolean") {
        events[key] = body.events[key];
      }
    }
  }

  const next = {
    ...current,
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    webhookUrl,
    events,
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
