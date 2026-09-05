import { isAdminD1Available } from "./d1-system-log.js";

/**
 * @param {string} email
 */
export async function hashSubscriberEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} email
 */
export async function readSubscriberD1(env, email) {
  if (!isAdminD1Available(env)) return null;
  const db = env.ADMIN_D1;
  const emailHash = await hashSubscriberEmail(email);
  try {
    const row = await db
      .prepare(
        `SELECT email_hash, subscribed_at, source, meta_json
         FROM subscriber_index
         WHERE email_hash = ?`
      )
      .bind(emailHash)
      .first();
    if (!row) return null;
    let meta = {};
    try {
      meta = row.meta_json ? JSON.parse(String(row.meta_json)) : {};
    } catch {
      meta = {};
    }
    return {
      email: String(meta.email ?? email).trim().toLowerCase(),
      subscribedAt: String(row.subscribed_at ?? meta.subscribedAt ?? new Date().toISOString()),
      source: String(row.source ?? meta.source ?? "website"),
      installId: meta.installId ?? null,
      consentVersion: String(meta.consentVersion ?? "2026-08-25"),
    };
  } catch (err) {
    console.error("readSubscriberD1 failed", err);
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ email: string; subscribedAt: string; source: string; installId?: string | null; consentVersion: string }} record
 */
export async function upsertSubscriberD1(env, record) {
  if (!isAdminD1Available(env)) return { ok: false, error: "ADMIN_D1 unavailable" };
  const db = env.ADMIN_D1;
  const emailHash = await hashSubscriberEmail(record.email);
  const meta = {
    email: record.email,
    installId: record.installId ?? null,
    consentVersion: record.consentVersion,
  };
  try {
    await db
      .prepare(
        `INSERT INTO subscriber_index (email_hash, subscribed_at, source, meta_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(email_hash) DO UPDATE SET
           subscribed_at = excluded.subscribed_at,
           source = excluded.source,
           meta_json = excluded.meta_json`
      )
      .bind(emailHash, record.subscribedAt, record.source, JSON.stringify(meta))
      .run();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("upsertSubscriberD1 failed", err);
    return { ok: false, error: message };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {number} [limit]
 */
export async function listSubscribersD1(env, limit = 5000) {
  if (!isAdminD1Available(env)) return [];
  const db = env.ADMIN_D1;
  const capped = Math.max(1, Math.min(limit, 5000));
  try {
    const result = await db
      .prepare(
        `SELECT subscribed_at, source, meta_json
         FROM subscriber_index
         ORDER BY subscribed_at DESC
         LIMIT ?`
      )
      .bind(capped)
      .all();
    return (result?.results ?? [])
      .map((row) => {
        let meta = {};
        try {
          meta = row.meta_json ? JSON.parse(String(row.meta_json)) : {};
        } catch {
          meta = {};
        }
        const email = String(meta.email ?? "").trim().toLowerCase();
        if (!email) return null;
        return {
          email,
          subscribedAt: String(row.subscribed_at ?? meta.subscribedAt ?? new Date().toISOString()),
          source: String(row.source ?? meta.source ?? "website"),
          installId: meta.installId ?? null,
          consentVersion: String(meta.consentVersion ?? "2026-08-25"),
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error("listSubscribersD1 failed", err);
    return [];
  }
}
