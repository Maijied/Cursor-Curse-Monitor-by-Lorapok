import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  readStatsRefreshConfig,
  readStatsLiveCache,
  sanitizeStatsRefreshConfigForClient,
  writeStatsRefreshConfig,
} from "../../_shared/stats-refresh-config.js";

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

  const [config, cache] = await Promise.all([
    readStatsRefreshConfig(env),
    readStatsLiveCache(env),
  ]);

  return jsonResponse(
    {
      ok: true,
      config: sanitizeStatsRefreshConfigForClient(config),
      cache: cache
        ? {
            refreshedAt: cache.refreshedAt,
            displayTotal: cache.downloads?.displayTotal ?? null,
            verified: cache.downloads?.verified ?? false,
            syncStatus: cache.marketplaceSync?.syncStatus ?? null,
          }
        : null,
    },
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

  try {
    const config = await writeStatsRefreshConfig(env, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      intervalMinutes:
        body.intervalMinutes != null ? Number(body.intervalMinutes) : undefined,
      updatedBy: auth.email,
    });
    return jsonResponse({ ok: true, config: sanitizeStatsRefreshConfigForClient(config) }, 200, CORS_HEADERS);
  } catch (err) {
    return jsonResponse(
      { error: formatKvPutError(err) },
      503,
      CORS_HEADERS
    );
  }
}
