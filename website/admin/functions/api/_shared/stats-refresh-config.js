import {
  clampIntervalMinutes,
  CRON_RUN_DEFAULTS,
  isCronJobDue,
  mergeCronJobConfig,
  sanitizeCronRunMetaForClient,
} from "./cron-schedule.js";
import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:stats-refresh";
const CACHE_KEY = "stats:live-cache";
const README_SVG_KEY = "stats:readme-svg";

export const STATS_REFRESH_CONFIG_KEY = CONFIG_KEY;

export const STATS_REFRESH_CACHE_KEY = CACHE_KEY;
export const STATS_README_SVG_KEY = README_SVG_KEY;
export const STATS_BADGES_BUNDLE_KEY = "stats:badges-bundle";

export const DEFAULT_STATS_REFRESH_CONFIG = {
  enabled: true,
  intervalMinutes: 5,
  ...CRON_RUN_DEFAULTS,
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
    return normalizeStatsRefreshConfig(parsed);
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
  const next = mergeCronJobConfig(current, patch, { defaultInterval: 5, min: 1, max: 60 });
  await putKvJsonIfChanged(env, CONFIG_KEY, next);
  return next;
}

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeStatsRefreshConfig(parsed) {
  return {
    ...DEFAULT_STATS_REFRESH_CONFIG,
    ...parsed,
    enabled: parsed.enabled === true,
    intervalMinutes: clampIntervalMinutes(
      parsed.intervalMinutes,
      DEFAULT_STATS_REFRESH_CONFIG.intervalMinutes,
      { min: 1, max: 60 }
    ),
  };
}

/**
 * @param {typeof DEFAULT_STATS_REFRESH_CONFIG} config
 */
export function sanitizeStatsRefreshConfigForClient(config) {
  return sanitizeCronRunMetaForClient(config);
}

/**
 * @param {typeof DEFAULT_STATS_REFRESH_CONFIG} config
 */
export function isStatsRefreshDue(config, now = Date.now()) {
  return isCronJobDue(config, now);
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

/**
 * @param {Record<string, unknown> | null | undefined} cache
 * @param {number} [maxAgeMs]
 * @param {number} [now]
 */
export function isStatsLiveCacheFresh(cache, maxAgeMs = 5 * 60 * 1000, now = Date.now()) {
  if (!cache?.refreshedAt) return false;
  const at = Date.parse(String(cache.refreshedAt));
  if (Number.isNaN(at)) return false;
  return now - at < maxAgeMs;
}
