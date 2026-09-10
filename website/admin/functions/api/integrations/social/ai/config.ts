import { jsonResponse, verifyAdminRequest, requirePermission } from "../../../_shared/auth.js";
import { jsonConfigSaveResponse } from "../../../_shared/kv-api-response.js";
import { formatKvPutError } from "../../../_shared/kv-put.js";
import {
  mergeSocialAiConfigUpdate,
  readSocialAiConfig,
  sanitizeSocialAiConfigForClient,
  writeSocialAiConfig,
} from "../../../_shared/social-ai-config.js";

/**
 * Retrieves AI image + video generator settings (SOCIAL-04/05).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readSocialAiConfig(env);
  return jsonResponse({ ok: true, config: sanitizeSocialAiConfigForClient(config) });
}

/**
 * Updates one image provider, active provider, or video settings.
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

  const current = await readSocialAiConfig(env);
  let next;
  try {
    next = mergeSocialAiConfigUpdate(current, body);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Invalid configuration" }, 400);
  }

  next.updatedAt = new Date().toISOString();
  next.updatedBy = auth.email;

  try {
    await writeSocialAiConfig(env, next);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  return jsonConfigSaveResponse(env, { ok: true, config: sanitizeSocialAiConfigForClient(next) });
}
