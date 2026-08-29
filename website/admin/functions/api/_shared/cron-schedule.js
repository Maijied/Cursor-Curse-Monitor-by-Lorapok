/** @typedef {import('./cron-schedule.js').CronRunMeta} CronRunMeta */

/**
 * @typedef {{
 *   enabled: boolean;
 *   intervalMinutes: number;
 *   lastRunAt: string | null;
 *   lastRunOk: boolean | null;
 *   lastError: string | null;
 *   lastDurationMs: number | null;
 *   lastTriggeredBy: string | null;
 *   updatedAt: string | null;
 *   updatedBy: string | null;
 * }} CronRunMeta
 */

export const CRON_RUN_DEFAULTS = {
  lastRunAt: null,
  lastRunOk: null,
  lastError: null,
  lastDurationMs: null,
  lastTriggeredBy: null,
  updatedAt: null,
  updatedBy: null,
};

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {{ min?: number; max?: number }} [bounds]
 */
export function clampIntervalMinutes(value, fallback, bounds = {}) {
  const min = bounds.min ?? 1;
  const max = bounds.max ?? 60;
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * @param {{ enabled?: boolean; intervalMinutes?: number; lastRunAt?: string | null }} config
 * @param {number} [now]
 */
export function isCronJobDue(config, now = Date.now()) {
  if (!config?.enabled) return false;
  if (!config.lastRunAt) return true;
  const last = Date.parse(String(config.lastRunAt));
  if (Number.isNaN(last)) return true;
  const interval = Number(config.intervalMinutes ?? 1);
  return now - last >= interval * 60 * 1000;
}

/**
 * @param {Record<string, unknown>} config
 */
export function sanitizeCronRunMetaForClient(config) {
  return {
    enabled: config.enabled === true,
    intervalMinutes: Number(config.intervalMinutes ?? 1),
    lastRunAt: config.lastRunAt ?? null,
    lastRunOk: config.lastRunOk ?? null,
    lastError: config.lastError ?? null,
    lastDurationMs: config.lastDurationMs ?? null,
    lastTriggeredBy: config.lastTriggeredBy ?? null,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} patch
 * @param {{ min?: number; max?: number; defaultInterval?: number }} [options]
 */
export function mergeCronJobConfig(current, patch, options = {}) {
  const defaultInterval = options.defaultInterval ?? 5;
  const interval = clampIntervalMinutes(
    patch.intervalMinutes ?? current.intervalMinutes,
    Number(current.intervalMinutes ?? defaultInterval),
    { min: options.min ?? 1, max: options.max ?? 60 }
  );

  return {
    ...current,
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled === true,
    intervalMinutes: interval,
    updatedAt: new Date().toISOString(),
    updatedBy: typeof patch.updatedBy === "string" ? patch.updatedBy : current.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {Record<string, unknown>} next
 */
import { putKvJson } from "./kv-put.js";

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {Record<string, unknown>} current
 * @param {{
 *   ok: boolean;
 *   error?: string | null;
 *   durationMs?: number | null;
 *   triggeredBy?: string | null;
 *   at?: string;
 * }} result
 */
export async function recordCronJobRun(env, key, current, result) {
  const at = result.at ?? new Date().toISOString();
  const next = {
    ...current,
    lastRunAt: at,
    lastRunOk: result.ok,
    lastError: result.ok ? null : result.error ?? "failed",
    lastDurationMs: result.durationMs ?? null,
    lastTriggeredBy: result.triggeredBy ?? "cron",
    updatedAt: at,
  };
  await writeCronJobState(env, key, next);
  return next;
}
