import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { jsonConfigSaveResponse } from "../../_shared/kv-api-response.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  SOCIAL_PLATFORMS,
  mergeSocialPlatformUpdate,
  readSocialConfig,
  sanitizeSocialConfigForClient,
  writeSocialConfig,
} from "../../_shared/social-config.js";

/**
 * Retrieves multi-platform social integration settings (SOCIAL-01).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readSocialConfig(env);
  return jsonResponse({ ok: true, config: sanitizeSocialConfigForClient(config) });
}

/**
 * Updates one platform block under integrations:social.
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

  const platform = String(body.platform ?? "").trim();
  if (!SOCIAL_PLATFORMS.includes(platform)) {
    return jsonResponse({ error: "platform is required (telegram, mastodon, bluesky, x, linkedin)" }, 400);
  }

  const current = await readSocialConfig(env);
  let next;
  try {
    next = mergeSocialPlatformUpdate(current, platform, body);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Invalid configuration" }, 400);
  }

  next.updatedAt = new Date().toISOString();
  next.updatedBy = auth.email;

  try {
    await writeSocialConfig(env, next);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  return jsonConfigSaveResponse(env, { ok: true, config: sanitizeSocialConfigForClient(next) });
}
