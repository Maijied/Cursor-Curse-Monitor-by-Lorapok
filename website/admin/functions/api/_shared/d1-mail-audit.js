import { isAdminD1Available } from "./d1-system-log.js";

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} entry
 */
export async function insertMailAuditResendD1(env, entry) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) return false;

  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO mail_audit_resend
         (id, ts, transport, status, from_display, to_masked, subject_preview, message_id, category, sent_by_masked, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.id,
        entry.ts,
        entry.transport ?? "resend",
        entry.status ?? "sent",
        entry.from,
        entry.to,
        entry.subjectPreview ?? "",
        entry.messageId ?? null,
        entry.category ?? null,
        entry.sentBy ?? null,
        entry.error ?? null
      )
      .run();
    return true;
  } catch (err) {
    console.error("insertMailAuditResendD1 failed", err);
    return false;
  }
}

export { isAdminD1Available };
