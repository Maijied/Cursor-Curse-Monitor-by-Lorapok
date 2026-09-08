import { isAdminD1Available } from "./d1-system-log.js";
import { isMailR2Available } from "./r2-mail.js";

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
