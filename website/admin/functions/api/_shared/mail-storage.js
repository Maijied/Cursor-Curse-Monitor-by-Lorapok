import { isAdminD1Available } from "./d1-system-log.js";
import { getInMemoryKvWritePause, isKvWriteBlockedEarly } from "./kv-put.js";
import { isKvWritesPaused } from "./kv-quota.js";
import { isMailR2Available } from "./r2-mail.js";
import { readStatsRefreshConfig } from "./stats-refresh-config.js";

/** @typedef {"d1" | "kv" | "r2"} MailStorageMode */

/**
 * Mailbox primary store — D1 when bound unless forced to KV.
 * @param {Record<string, unknown>} env
 * @returns {MailStorageMode}
 */
export function resolveMailboxStorage(env) {
  const explicit = String(env?.CCM_MAIL_STORAGE ?? "").trim().toLowerCase();
  if (explicit === "kv") return "kv";
  if (explicit === "r2") return "r2";
  if (explicit === "d1" || isAdminD1Available(env)) return "d1";
  if (isMailR2Available(env)) return "r2";
  return "kv";
}

/**
 * Resend audit persistence order: R2 → D1 → KV scatter.
 * @param {Record<string, unknown>} env
 * @returns {"r2" | "d1" | "kv"}
 */
export function resolveMailAuditStorage(env) {
  const explicit = String(env?.CCM_MAIL_AUDIT_STORAGE ?? "").trim().toLowerCase();
  if (explicit === "kv") return "kv";
  if (explicit === "d1") return "d1";
  if (explicit === "r2") return "r2";
  if (isMailR2Available(env)) return "r2";
  if (isAdminD1Available(env)) return "d1";
  return "kv";
}

/**
 * Env flags that disable all KV writes on mail hot paths.
 * @param {Record<string, unknown>} env
 */
export function isKvWritesSkippedByEnv(env) {
  return env?.CCM_SKIP_KV === "1" || env?.CCM_SKIP_KV === "true";
}

/**
 * Synchronous early guard — env flags + in-memory quota pause.
 * @param {Record<string, unknown>} env
 * @param {string | null | undefined} [writesPausedUntil]
 */
export function shouldBlockKvWritesSync(env, writesPausedUntil = null) {
  if (isKvWritesSkippedByEnv(env)) return true;
  if (isKvWriteBlockedEarly(writesPausedUntil)) return true;
  return false;
}

/**
 * Async guard — also reads stats-refresh `writesPausedUntil` from KV config.
 * @param {Record<string, unknown>} env
 */
export async function shouldBlockKvWrites(env) {
  if (shouldBlockKvWritesSync(env)) return true;
  try {
    const config = await readStatsRefreshConfig(env);
    if (config.writesPausedUntil && isKvWritesPaused(config.writesPausedUntil)) {
      return true;
    }
  } catch {
    // Config read failed — don't block mail on top of that
  }
  return false;
}

/**
 * Whether mailbox metadata should avoid KV entirely (D1/R2 primary).
 * @param {Record<string, unknown>} env
 */
export function prefersNonKvMailboxStorage(env) {
  const mode = resolveMailboxStorage(env);
  return mode === "d1" || mode === "r2";
}

/**
 * Expose pause state for diagnostics (sync status, health).
 */
export function getKvWritePauseState() {
  return {
    inMemoryPausedUntil: getInMemoryKvWritePause(),
  };
}
