/**
 * KV write helpers — skip unchanged values to stay under Cloudflare daily put limits.
 * Safe puts catch quota errors so mail/cron hot paths never fail outbound delivery.
 */

import {
  formatKvQuotaError,
  isKvQuotaError,
  isKvWritesPaused,
  nextUtcQuotaResetIso,
} from "./kv-quota.js";

/** In-memory pause until UTC reset — shared across requests in the same isolate. */
let kvWritePausedUntil = null;

/**
 * @param {unknown} err
 */
export function formatKvPutError(err) {
  const message = err instanceof Error ? err.message : String(err ?? "Save failed");
  if (isKvQuotaError(message)) {
    return formatKvQuotaError(err);
  }
  return message || "Save failed";
}

/**
 * ISO timestamp when this isolate learned KV writes are blocked (UTC midnight reset).
 */
export function getInMemoryKvWritePause() {
  if (isKvWritesPaused(kvWritePausedUntil)) return kvWritePausedUntil;
  kvWritePausedUntil = null;
  return null;
}

/**
 * Record a KV quota hit so subsequent hot-path writes skip KV until UTC reset.
 * @returns {string} pause-until ISO timestamp
 */
export function markKvWriteQuotaHit() {
  kvWritePausedUntil = nextUtcQuotaResetIso();
  return kvWritePausedUntil;
}

/** Clear in-memory pause (tests only). */
export function clearKvWritePause() {
  kvWritePausedUntil = null;
}

/**
 * @param {string | null | undefined} [writesPausedUntil]
 * @param {number} [now]
 */
export function isKvWriteBlockedEarly(writesPausedUntil = null, now = Date.now()) {
  if (writesPausedUntil && isKvWritesPaused(writesPausedUntil, now)) return true;
  return Boolean(getInMemoryKvWritePause());
}

/**
 * Accept either a Workers env (`{ ADMIN_KV }`) or a KV namespace (legacy callers passed `env.ADMIN_KV`).
 * @param {Record<string, unknown> | import("@cloudflare/workers-types").KVNamespace | null | undefined} envOrKv
 */
export function resolveKvBinding(envOrKv) {
  if (!envOrKv || typeof envOrKv !== "object") return null;
  if ("ADMIN_KV" in envOrKv && envOrKv.ADMIN_KV) {
    return /** @type {import("@cloudflare/workers-types").KVNamespace} */ (envOrKv.ADMIN_KV);
  }
  if (typeof envOrKv.get === "function" && typeof envOrKv.put === "function") {
    return /** @type {import("@cloudflare/workers-types").KVNamespace} */ (envOrKv);
  }
  return null;
}

/**
 * @typedef {Object} KvPutResult
 * @property {boolean} ok — operation completed without fatal error
 * @property {boolean} wrote — KV put was executed
 * @property {boolean} [skipped] — write intentionally skipped
 * @property {string} [reason] — skip/failure reason
 * @property {boolean} [quotaExceeded]
 */

/**
 * KV put that never throws on quota errors — for mail, audit, and scatter hot paths.
 * @param {Record<string, unknown> | import("@cloudflare/workers-types").KVNamespace} envOrKv
 * @param {string} key
 * @param {string} value
 * @param {{ skipIfUnchanged?: boolean; writesPausedUntil?: string | null; required?: boolean; expirationTtl?: number }} [options]
 * @returns {Promise<KvPutResult>}
 */
export async function putKvStringSafe(envOrKv, key, value, options = {}) {
  const { skipIfUnchanged = false, writesPausedUntil = null, required = false, expirationTtl } = options;

  if (isKvWriteBlockedEarly(writesPausedUntil)) {
    return { ok: true, wrote: false, skipped: true, reason: "kv_writes_paused", quotaExceeded: true };
  }

  const kv = resolveKvBinding(envOrKv);
  if (!kv?.put) {
    if (required) throw new Error("ADMIN_KV binding not configured");
    return { ok: false, wrote: false, reason: "kv-unavailable" };
  }

  try {
    if (skipIfUnchanged) {
      const current = await kv.get(key);
      if (current === value) {
        return { ok: true, wrote: false, skipped: true, reason: "unchanged" };
      }
    }
    if (expirationTtl) {
      await kv.put(key, value, { expirationTtl });
    } else {
      await kv.put(key, value);
    }
    return { ok: true, wrote: true };
  } catch (err) {
    if (isKvQuotaError(err)) {
      markKvWriteQuotaHit();
      return { ok: true, wrote: false, skipped: true, reason: "quota_exceeded", quotaExceeded: true };
    }
    if (required) throw err;
    const message = err instanceof Error ? err.message : String(err ?? "Save failed");
    return { ok: false, wrote: false, reason: message };
  }
}

/**
 * @param {Record<string, unknown> | import("@cloudflare/workers-types").KVNamespace} envOrKv
 * @param {string} key
 * @param {unknown} value
 * @param {{ skipIfUnchanged?: boolean; writesPausedUntil?: string | null; required?: boolean }} [options]
 * @returns {Promise<KvPutResult>}
 */
export async function putKvJsonSafe(envOrKv, key, value, options = {}) {
  return putKvStringSafe(envOrKv, key, JSON.stringify(value), options);
}

/**
 * @param {Record<string, unknown> | import("@cloudflare/workers-types").KVNamespace} envOrKv
 * @param {string} key
 * @param {string} value
 * @returns {Promise<KvPutResult & { changed: boolean }>}
 */
export async function putKvStringIfChanged(envOrKv, key, value) {
  const result = await putKvStringSafe(envOrKv, key, value, { skipIfUnchanged: true });
  if (!result.ok && result.reason && result.reason !== "unchanged" && !result.quotaExceeded) {
    throw new Error(result.reason);
  }
  return { ...result, changed: Boolean(result.wrote) };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<KvPutResult & { changed: boolean }>}
 */
export async function putKvJsonIfChanged(env, key, value) {
  const serialized = JSON.stringify(value);
  return putKvStringIfChanged(env, key, serialized);
}

/**
 * Config/cron KV write — never throws on quota; callers check `quotaExceeded` / use kvDegradedMeta.
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<KvPutResult & { changed: boolean }>}
 */
export async function putKvConfigJson(env, key, value) {
  return putKvJsonIfChanged(env, key, value);
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {unknown} value
 */
export async function putKvJson(envOrKv, key, value) {
  const result = await putKvJsonSafe(envOrKv, key, value);
  if (!result.ok && !result.quotaExceeded) {
    throw new Error(result.reason ?? "ADMIN_KV put failed");
  }
  return result;
}
