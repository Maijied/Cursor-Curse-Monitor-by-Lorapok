import {
  CRON_RUN_DEFAULTS,
  clampIntervalMinutes,
  isCronJobDue,
  mergeCronJobConfig,
  sanitizeCronRunMetaForClient,
} from "./cron-schedule.js";
import { putKvJsonIfChanged } from "./kv-put.js";

export const DISCORD_DIGEST_CONFIG_KEY = "integrations:discord-digest";

export const DISCORD_DIGEST_INTERVAL = { min: 60, max: 10080, default: 1440 };

export const DEFAULT_DISCORD_DIGEST_CONFIG = {
  enabled: false,
  intervalMinutes: DISCORD_DIGEST_INTERVAL.default,
  refreshBeforeSend: true,
  includeChangelog: true,
  ...CRON_RUN_DEFAULTS,
};

/**
 * @param {Record<string, unknown>} env
 */
export async function readDiscordDigestConfig(env) {
  if (!env.ADMIN_KV?.get) return { ...DEFAULT_DISCORD_DIGEST_CONFIG };
  try {
    const raw = await env.ADMIN_KV.get(DISCORD_DIGEST_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_DISCORD_DIGEST_CONFIG };
    const parsed = JSON.parse(raw);
    return normalizeDiscordDigestConfig(parsed);
  } catch {
    return { ...DEFAULT_DISCORD_DIGEST_CONFIG };
  }
}

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeDiscordDigestConfig(parsed) {
  return {
    ...DEFAULT_DISCORD_DIGEST_CONFIG,
    ...parsed,
    enabled: parsed.enabled === true,
    intervalMinutes: clampIntervalMinutes(
      parsed.intervalMinutes,
      DISCORD_DIGEST_INTERVAL.default,
      DISCORD_DIGEST_INTERVAL
    ),
    refreshBeforeSend: parsed.refreshBeforeSend !== false,
    includeChangelog: parsed.includeChangelog !== false,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} patch
 */
export async function writeDiscordDigestConfig(env, patch) {
  const current = await readDiscordDigestConfig(env);
  const merged = mergeCronJobConfig(current, patch, {
    defaultInterval: DISCORD_DIGEST_INTERVAL.default,
    min: DISCORD_DIGEST_INTERVAL.min,
    max: DISCORD_DIGEST_INTERVAL.max,
  });
  const next = {
    ...merged,
    refreshBeforeSend:
      typeof patch.refreshBeforeSend === "boolean" ? patch.refreshBeforeSend : current.refreshBeforeSend,
    includeChangelog:
      typeof patch.includeChangelog === "boolean" ? patch.includeChangelog : current.includeChangelog,
  };
  if (!env.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await putKvJsonIfChanged(env, DISCORD_DIGEST_CONFIG_KEY, next);
  return next;
}

/**
 * @param {typeof DEFAULT_DISCORD_DIGEST_CONFIG} config
 */
export function sanitizeDiscordDigestConfigForClient(config) {
  return {
    ...sanitizeCronRunMetaForClient(config),
    refreshBeforeSend: config.refreshBeforeSend !== false,
    includeChangelog: config.includeChangelog !== false,
  };
}

/**
 * @param {typeof DEFAULT_DISCORD_DIGEST_CONFIG} config
 * @param {number} [now]
 */
export function isDiscordDigestDue(config, now = Date.now()) {
  return isCronJobDue(config, now);
}
