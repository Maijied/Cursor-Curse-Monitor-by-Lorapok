import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  isValidDiscordInviteUrl,
  readSubscribeConfig,
  sanitizeSubscribeConfigForClient,
  writeSubscribeConfig,
} from "../../_shared/subscribe-config.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const config = await readSubscribeConfig(env);
  return jsonResponse(
    { ok: true, config: sanitizeSubscribeConfigForClient(config) },
    200,
    CORS_HEADERS
  );
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403, CORS_HEADERS);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  if (
    body.subscribeFallbackDiscordUrl !== undefined &&
    body.subscribeFallbackDiscordUrl !== null &&
    body.subscribeFallbackDiscordUrl !== "" &&
    !isValidDiscordInviteUrl(String(body.subscribeFallbackDiscordUrl))
  ) {
    return jsonResponse({ error: "Invalid Discord invite URL" }, 400, CORS_HEADERS);
  }

  if (
    body.subscribeFallbackMode !== undefined &&
    body.subscribeFallbackMode !== "discord" &&
    body.subscribeFallbackMode !== "hidden"
  ) {
    return jsonResponse({ error: "subscribeFallbackMode must be discord or hidden" }, 400, CORS_HEADERS);
  }

  try {
    const config = await writeSubscribeConfig(env, {
      subscribeModalEnabled:
        typeof body.subscribeModalEnabled === "boolean"
          ? body.subscribeModalEnabled
          : undefined,
      requireMailForSubscribe:
        typeof body.requireMailForSubscribe === "boolean"
          ? body.requireMailForSubscribe
          : undefined,
      subscribeFallbackDiscordUrl:
        body.subscribeFallbackDiscordUrl !== undefined
          ? String(body.subscribeFallbackDiscordUrl ?? "").trim()
          : undefined,
      subscribeFallbackMode:
        body.subscribeFallbackMode === "discord" || body.subscribeFallbackMode === "hidden"
          ? body.subscribeFallbackMode
          : undefined,
      updatedBy: auth.email,
    });
    return jsonResponse(
      { ok: true, config: sanitizeSubscribeConfigForClient(config) },
      200,
      CORS_HEADERS
    );
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503, CORS_HEADERS);
  }
}
