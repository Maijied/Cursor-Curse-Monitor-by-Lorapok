import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  GITHUB_CRON_JOBS,
  MANAGED_CRON_JOBS,
} from "../../_shared/cron-jobs-registry.js";
import {
  readDiscordDigestConfig,
  sanitizeDiscordDigestConfigForClient,
  writeDiscordDigestConfig,
} from "../../_shared/discord-digest-config.js";
import {
  readStatsLiveCache,
  readStatsRefreshConfig,
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

  const [statsRefresh, discordDigest, cache] = await Promise.all([
    readStatsRefreshConfig(env),
    readDiscordDigestConfig(env),
    readStatsLiveCache(env),
  ]);

  return jsonResponse(
    {
      ok: true,
      githubJobs: GITHUB_CRON_JOBS,
      managedJobs: MANAGED_CRON_JOBS,
      statsRefresh: sanitizeStatsRefreshConfigForClient(statsRefresh),
      discordDigest: sanitizeDiscordDigestConfigForClient(discordDigest),
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
    const [statsRefresh, discordDigest] = await Promise.all([
      body.statsRefresh
        ? writeStatsRefreshConfig(env, {
            enabled:
              typeof body.statsRefresh.enabled === "boolean" ? body.statsRefresh.enabled : undefined,
            intervalMinutes:
              body.statsRefresh.intervalMinutes != null
                ? Number(body.statsRefresh.intervalMinutes)
                : undefined,
            updatedBy: auth.email,
          })
        : readStatsRefreshConfig(env),
      body.discordDigest
        ? writeDiscordDigestConfig(env, {
            enabled:
              typeof body.discordDigest.enabled === "boolean" ? body.discordDigest.enabled : undefined,
            intervalMinutes:
              body.discordDigest.intervalMinutes != null
                ? Number(body.discordDigest.intervalMinutes)
                : undefined,
            refreshBeforeSend:
              typeof body.discordDigest.refreshBeforeSend === "boolean"
                ? body.discordDigest.refreshBeforeSend
                : undefined,
            includeChangelog:
              typeof body.discordDigest.includeChangelog === "boolean"
                ? body.discordDigest.includeChangelog
                : undefined,
            updatedBy: auth.email,
          })
        : readDiscordDigestConfig(env),
    ]);

    return jsonResponse(
      {
        ok: true,
        statsRefresh: sanitizeStatsRefreshConfigForClient(statsRefresh),
        discordDigest: sanitizeDiscordDigestConfigForClient(discordDigest),
      },
      200,
      CORS_HEADERS
    );
  } catch (err) {
    return jsonResponse(
      { error: formatKvPutError(err) },
      503,
      CORS_HEADERS
    );
  }
}
