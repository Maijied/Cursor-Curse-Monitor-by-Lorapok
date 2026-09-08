/**
 * Mail object storage on STATS_R2 — append-only outbox archives, audit JSON, KV backups.
 * Reuses the existing `ccm-admin-stats` bucket with `mail/` prefixes (no new bucket required).
 *
 * Free tier (monthly): 10 GB storage, 1M Class A ops, 10M Class B ops.
 * @see r2-stats.js
 */

import { isR2NotEntitledError, isR2QuotaOrLimitError } from "./r2-stats.js";

export const MAIL_R2_OUTBOX_PREFIX = "mail/outbox/";
export const MAIL_R2_AUDIT_PREFIX = "mail/audit/";
export const MAIL_R2_BACKUP_PREFIX = "mail/backups/";

/**
 * @param {Record<string, unknown>} env
 */
export function isMailR2Available(env) {
  return Boolean(env?.STATS_R2?.put);
}

/**
 * @param {string} id
 */
export function mailOutboxR2Key(id) {
  return `${MAIL_R2_OUTBOX_PREFIX}${id}.json`;
}

/**
 * @param {string} id
 * @param {string} [ts]
 */
export function mailAuditR2Key(id, ts = new Date().toISOString()) {
  const day = String(ts).slice(0, 10);
  return `${MAIL_R2_AUDIT_PREFIX}${day}/${id}.json`;
}

/**
 * @param {string} sourceKey
 * @param {number} [ts]
 */
export function mailBackupR2Key(sourceKey, ts = Date.now()) {
  const slug = String(sourceKey).replace(/:/g, "-");
  return `${MAIL_R2_BACKUP_PREFIX}${ts}-${slug}.json`;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {unknown} value
 */
export async function putMailR2Json(env, key, value) {
  const bucket = env?.STATS_R2;
  if (!bucket?.put) return false;
  try {
    await bucket.put(key, JSON.stringify(value), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    return true;
  } catch (err) {
    console.error("putMailR2Json failed", key, err);
    if (isR2NotEntitledError(err) || isR2QuotaOrLimitError(err)) {
      console.warn("STATS_R2 mail write blocked");
    }
    return false;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 */
export async function getMailR2Json(env, key) {
  const bucket = env?.STATS_R2;
  if (!bucket?.get) return null;
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return JSON.parse(await obj.text());
  } catch (err) {
    console.error("getMailR2Json failed", key, err);
    return null;
  }
}

/**
 * Archive one mailbox message — one Class A put per send (no RMW).
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} entry
 */
export async function writeMailOutboxArchive(env, entry) {
  if (!entry?.id) return false;
  return putMailR2Json(env, mailOutboxR2Key(String(entry.id)), entry);
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} entry
 */
export async function writeMailAuditR2(env, entry) {
  if (!entry?.id) return false;
  return putMailR2Json(env, mailAuditR2Key(String(entry.id), String(entry.ts ?? "")), entry);
}

/**
 * Immutable mailbox snapshot before KV compaction (replaces backup:point KV writes).
 * @param {Record<string, unknown>} env
 * @param {string} sourceKey
 * @param {string} serialized
 * @param {{ reason?: string; triggeredBy?: string }} [options]
 */
export async function backupMailboxPayloadR2(env, sourceKey, serialized, options = {}) {
  const envelope = {
    schemaVersion: 1,
    sourceKey,
    backedUpAt: new Date().toISOString(),
    reason: options.reason ?? "mailbox-compaction",
    triggeredBy: options.triggeredBy ?? "writeAll",
    byteLength: serialized.length,
    payload: serialized,
  };
  return putMailR2Json(env, mailBackupR2Key(sourceKey), envelope);
}

/**
 * @param {Record<string, unknown>} env
 */
export function shouldArchiveMailToR2(env) {
  if (env?.CCM_MAIL_SKIP_R2_ARCHIVE === "1" || env?.CCM_MAIL_SKIP_R2_ARCHIVE === "true") {
    return false;
  }
  return isMailR2Available(env);
}
