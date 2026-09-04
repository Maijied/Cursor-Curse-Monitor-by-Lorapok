import { jsonResponse, verifyAdminRequest } from "../_shared/auth.js";
import { githubFetch } from "../_shared/github.js";
import { getMailTransportStatus } from "../_shared/mail.js";
import {
  isStatsLiveCacheFresh,
  readStatsLiveCache,
  readStatsRefreshConfig,
  sanitizeStatsRefreshConfigForClient,
} from "../_shared/stats-refresh-config.js";
import { formatKvPutError } from "../_shared/kv-put.js";
import { isKvQuotaError, isKvWritesPaused, kvQuotaKind } from "../_shared/kv-quota.js";
import { probeAdminD1 } from "../_shared/d1-admin.js";

/**
 * Aggregated sync health for Mission Control polling (admin auth).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const now = Date.now();
  let githubOk = false;
  try {
    const res = await githubFetch("/zen", env);
    githubOk = res.ok;
  } catch {
    githubOk = false;
  }

  const mail = getMailTransportStatus(env);
  const statsConfig = sanitizeStatsRefreshConfigForClient(await readStatsRefreshConfig(env));
  const cache = await readStatsLiveCache(env);
  const refreshedAt = cache?.refreshedAt ? String(cache.refreshedAt) : null;
  const refreshedMs = refreshedAt ? Date.parse(refreshedAt) : NaN;
  const ageSeconds =
    refreshedAt && !Number.isNaN(refreshedMs)
      ? Math.max(0, Math.round((now - refreshedMs) / 1000))
      : null;
  const intervalMs = (statsConfig.intervalMinutes ?? 5) * 60 * 1000;
  const staleThresholdMs = intervalMs * 2;
  const cacheFresh = isStatsLiveCacheFresh(cache, staleThresholdMs, now);
  const lastError = statsConfig.lastError ?? null;
  const writesPausedUntil = statsConfig.writesPausedUntil ?? null;
  const kvWritesPaused = isKvWritesPaused(writesPausedUntil, now);
  const kvQuotaHit = Boolean((lastError && isKvQuotaError(lastError)) || kvWritesPaused);
  const kvQuotaLimitKind = lastError ? kvQuotaKind(lastError) : kvWritesPaused ? "write" : null;
  const adminD1 = await probeAdminD1(env);

  let overall: "online" | "degraded" | "offline" = "online";
  if (!githubOk || !env.ADMIN_KV) {
    overall = "offline";
  } else if (!mail.configured || !cacheFresh || kvQuotaHit) {
    overall = "degraded";
  }

  return jsonResponse({
    ok: overall !== "offline",
    overall,
    checkedAt: new Date(now).toISOString(),
    github: { ok: githubOk },
    adminKv: { configured: Boolean(env.ADMIN_KV) },
    adminD1: {
      configured: adminD1.configured,
      ok: adminD1.ok,
      error: adminD1.error ?? null,
    },
    mail: {
      configured: mail.configured,
      transport: mail.transport ?? null,
      relayBound: mail.relayBound ?? false,
      resendConfigured: mail.resendConfigured ?? false,
    },
    stats: {
      enabled: statsConfig.enabled,
      intervalMinutes: statsConfig.intervalMinutes,
      lastRunAt: statsConfig.lastRunAt ?? null,
      lastRunOk: statsConfig.lastRunOk ?? null,
      lastRunError: lastError,
      writesPausedUntil,
      kvQuotaHit,
      kvQuotaLimitKind,
      cache: {
        refreshedAt,
        ageSeconds,
        fresh: cacheFresh,
        displayTotal: cache?.downloads?.displayTotal ?? null,
        syncStatus: cache?.marketplaceSync?.syncStatus ?? null,
      },
    },
    hint: kvQuotaHit
      ? kvWritesPaused
        ? `KV writes paused until ${writesPausedUntil} (UTC). Automatic stats refresh is skipped to protect the daily quota.`
        : formatKvPutError(new Error(lastError ?? "KV limit"))
      : null,
  });
}
