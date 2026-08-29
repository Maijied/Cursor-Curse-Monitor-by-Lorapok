const CONFIG_KEY = "integrations:stats-refresh";
const CACHE_KEY = "stats:live-cache";

export const STATS_REFRESH_CACHE_KEY = CACHE_KEY;

export const DEFAULT_STATS_REFRESH_CONFIG = {
  enabled: false,
  intervalMinutes: 5,
  lastRunAt: null,
  lastRunOk: null,
  lastError: null,
  lastDurationMs: null,
  lastTriggeredBy: null,
  updatedAt: null,
  updatedBy: null,
};

/**
 * @param {Record<string, unknown>} env
 */
export async function readStatsRefreshConfig(env) {
  if (!env.ADMIN_KV?.get) return { ...DEFAULT_STATS_REFRESH_CONFIG };
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_STATS_REFRESH_CONFIG };
    const parsed = JSON.parse(raw);
    const interval = Number(parsed.intervalMinutes ?? DEFAULT_STATS_REFRESH_CONFIG.intervalMinutes);
    return {
      ...DEFAULT_STATS_REFRESH_CONFIG,
      ...parsed,
      intervalMinutes: Number.isFinite(interval)
        ? Math.min(60, Math.max(1, Math.round(interval)))
        : DEFAULT_STATS_REFRESH_CONFIG.intervalMinutes,
      enabled: parsed.enabled === true,
    };
  } catch {
    return { ...DEFAULT_STATS_REFRESH_CONFIG };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} patch
 */
export async function writeStatsRefreshConfig(env, patch) {
  if (!env.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const current = await readStatsRefreshConfig(env);
  const interval = Number(patch.intervalMinutes ?? current.intervalMinutes);
  const next = {
    ...current,
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    intervalMinutes: Number.isFinite(interval)
      ? Math.min(60, Math.max(1, Math.round(interval)))
      : current.intervalMinutes,
    updatedAt: new Date().toISOString(),
    updatedBy: typeof patch.updatedBy === "string" ? patch.updatedBy : current.updatedBy,
  };
  await env.ADMIN_KV.put(CONFIG_KEY, JSON.stringify(next));
  return next;
}

/**
 * @param {typeof DEFAULT_STATS_REFRESH_CONFIG} config
 */
export function sanitizeStatsRefreshConfigForClient(config) {
  return {
    enabled: config.enabled,
    intervalMinutes: config.intervalMinutes,
    lastRunAt: config.lastRunAt,
    lastRunOk: config.lastRunOk,
    lastError: config.lastError,
    lastDurationMs: config.lastDurationMs,
    lastTriggeredBy: config.lastTriggeredBy,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
}

/**
 * @param {typeof DEFAULT_STATS_REFRESH_CONFIG} config
 */
export function isStatsRefreshDue(config, now = Date.now()) {
  if (!config.enabled) return false;
  if (!config.lastRunAt) return true;
  const last = Date.parse(config.lastRunAt);
  if (Number.isNaN(last)) return true;
  return now - last >= config.intervalMinutes * 60 * 1000;
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readStatsLiveCache(env) {
  if (!env.ADMIN_KV?.get) return null;
  try {
    const raw = await env.ADMIN_KV.get(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
