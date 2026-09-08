/**
 * Helpers for config/API handlers — return degraded 200 instead of 503 when KV quota is hit.
 */

import { jsonResponse } from "./auth.js";
import { formatKvQuotaError } from "./kv-quota.js";
import { getInMemoryKvWritePause, isKvWriteBlockedEarly } from "./kv-put.js";
import { shouldBlockKvWrites } from "./mail-storage.js";
import { isFirestoreFallbackAvailable } from "./firebase-store.js";

/**
 * @typedef {{ degraded?: boolean; warning?: string; kvWritesPaused?: boolean }} KvDegradedMeta
 */

/**
 * Whether KV writes should be treated as blocked right now (env, in-memory, persisted pause).
 * @param {Record<string, unknown>} env
 */
export async function isKvWriteDegraded(env) {
  return await shouldBlockKvWrites(env);
}

/**
 * Build optional degraded fields for a successful JSON response after a config save.
 * @param {Record<string, unknown>} env
 * @param {{ quotaExceeded?: boolean }} [putResult]
 * @returns {KvDegradedMeta}
 */
export async function kvDegradedMeta(env, putResult = {}) {
  const blocked =
    putResult.quotaExceeded === true ||
    isKvWriteBlockedEarly() ||
    (await shouldBlockKvWrites(env));
  if (!blocked) return {};
  const pause = getInMemoryKvWritePause();
  const firestore = isFirestoreFallbackAvailable(env);
  return {
    degraded: true,
    kvWritesPaused: true,
    warning: formatKvQuotaError(new Error("KV put() limit exceeded for the day")),
    ...(firestore ? { firestoreFallback: true } : {}),
    ...(pause ? { writesPausedUntil: pause } : {}),
  };
}

/**
 * Merge config payload with degraded meta for settings APIs.
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>} env
 * @param {{ quotaExceeded?: boolean }} [putResult]
 */
export async function withKvDegradedFields(body, env, putResult = {}) {
  const meta = await kvDegradedMeta(env, putResult);
  return { ...body, ...meta };
}

/**
 * JSON response for settings/config saves — adds degraded meta when KV quota blocks writes.
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} body
 * @param {number} [status]
 * @param {Record<string, string>} [headers]
 */
export async function jsonConfigSaveResponse(env, body, status = 200, headers = {}) {
  const enriched = await withKvDegradedFields(body, env);
  return jsonResponse(enriched, status, headers);
}
