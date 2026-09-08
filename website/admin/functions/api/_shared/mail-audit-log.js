import { truncateStoredText } from "./kv-limits.js";
import { maskEmail, maskEmailDisplay } from "./mask-email.js";
import { putScatterRecord } from "./kv-scatter.js";
import { insertMailAuditResendD1 } from "./d1-mail-audit.js";
import { resolveMailAuditStorage, shouldBlockKvWrites } from "./mail-storage.js";
import { writeMailAuditR2 } from "./r2-mail.js";

export const MAIL_AUDIT_RESEND_PREFIX = "mail:audit:resend";
const MAIL_AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * @typedef {Object} ResendMailAuditEntry
 * @property {string} id
 * @property {string} ts
 * @property {"resend" | "resend-fallback"} transport
 * @property {"sent" | "failed"} status
 * @property {string} from
 * @property {string} to
 * @property {string} subjectPreview
 * @property {string | null} [messageId]
 * @property {string | null} [category]
 * @property {string | null} [sentBy]
 * @property {string | null} [error]
 */

/**
 * Build a masked audit payload — never includes raw recipient addresses.
 * @param {Partial<ResendMailAuditEntry> & { from: string; to: string; subject?: string }} input
 */
export function buildResendAuditEntry(input) {
  const id = input.id ?? crypto.randomUUID();
  const ts = input.ts ?? new Date().toISOString();
  return {
    id,
    ts,
    transport: input.transport ?? "resend",
    status: input.status ?? "sent",
    from: maskEmailDisplay(input.from),
    to: maskEmail(input.to),
    subjectPreview: truncateStoredText(input.subject ?? "", 120),
    messageId: input.messageId ?? null,
    category: input.category ?? null,
    sentBy: input.sentBy ? maskEmail(input.sentBy) : null,
    error: input.error ? truncateStoredText(input.error, 300) : null,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof buildResendAuditEntry>} entry
 */
async function persistMailAuditEntry(env, entry) {
  const mode = resolveMailAuditStorage(env);

  if (mode === "r2") {
    const ok = await writeMailAuditR2(env, entry);
    if (ok) return true;
  }

  if (mode === "d1" || mode === "r2") {
    const ok = await insertMailAuditResendD1(env, entry);
    if (ok) return true;
  }

  if (await shouldBlockKvWrites(env)) {
    return false;
  }

  if (env.ADMIN_KV?.put) {
    const wrote = await putScatterRecord(env.ADMIN_KV, MAIL_AUDIT_RESEND_PREFIX, entry.id, entry, {
      ts: Date.parse(entry.ts),
      expirationTtl: MAIL_AUDIT_TTL_SECONDS,
    });
    if (wrote) return true;
  }

  return false;
}

/**
 * Persist masked Resend send metadata via MAIL_AUDIT worker or direct R2/D1/KV fallback.
 * Non-blocking — callers should not await unless testing.
 * @param {Record<string, unknown>} env
 * @param {Partial<ResendMailAuditEntry> & { from: string; to: string; subject?: string }} input
 */
export async function logResendMailEvent(env, input) {
  const entry = buildResendAuditEntry(input);

  const audit = env.MAIL_AUDIT;
  if (audit?.fetch) {
    try {
      const res = await audit.fetch(
        new Request("https://internal/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        })
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`MAIL_AUDIT worker log failed: HTTP ${res.status} ${text.slice(0, 120)}`);
      } else {
        return entry;
      }
    } catch (err) {
      console.error("MAIL_AUDIT worker log failed", err);
    }
  }

  await persistMailAuditEntry(env, entry);
  return entry;
}

export { persistMailAuditEntry };
