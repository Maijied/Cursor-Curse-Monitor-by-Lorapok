/**
 * Saved-mail replay — D1 system_logs and mailbox KV sources (ops boundary, not Pages handlers).
 */
import { spawnSync } from "node:child_process";
import {
  buildComposeHtml,
  buildNoticeHtml,
  buildSubscribeHtml,
  buildTestHtml,
  getAdminPublicUrl,
} from "../../functions/api/_shared/mail.js";
import { listMailboxMessages } from "../../functions/api/_shared/mailbox.js";
import { MAIL_AUDIT_RESEND_PREFIX } from "../../functions/api/_shared/mail-audit-log.js";
import { listScatterRecords } from "../../functions/api/_shared/kv-scatter.js";
import { maskEmail, maskEmailDisplay } from "../../functions/api/_shared/mask-email.js";

export const MAILBOX_KEY = "mailbox:messages";
export const D1_DATABASE = "ccm-admin-d1";

export function runD1Query(sql, adminDir) {
  const out = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", D1_DATABASE, "--remote", "--command", sql],
    { cwd: adminDir, encoding: "utf8", env: process.env }
  );
  if (out.status !== 0) {
    throw new Error((out.stderr || out.stdout || "d1 execute failed").trim());
  }
  const match = out.stdout.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const payload = JSON.parse(match[0]);
  return payload[0]?.results ?? [];
}

export function d1RowToMessage(row) {
  let meta = {};
  try {
    meta = JSON.parse(row.meta_json ?? "{}");
  } catch {
    meta = {};
  }
  const failed = /failed/i.test(String(row.message ?? ""));
  const category = String(meta.category ?? "system");
  const to = String(meta.to ?? "").trim().toLowerCase();
  const subject = String(meta.subject ?? "").trim();
  const adminUrl = getAdminPublicUrl(process.env);

  let text = "";
  let html = "";
  let reconstruct = "template";

  if (category === "subscribe") {
    html = buildSubscribeHtml({ email: to });
    text = `Thanks for subscribing, ${to}. We'll email you about important updates from Cursor Curse Monitor.`;
  } else if (category === "test") {
    html = buildTestHtml({ email: to, adminUrl });
    text = `Mailbox test from Mission Control at ${row.ts}. Outbound mail replay.`;
  } else if (category === "notice") {
    const title = subject || "Cursor Curse Monitor update";
    const message = `Replay of a prior notice send (${row.ts}). Original delivery ${failed ? "failed" : "succeeded"}.`;
    html = buildNoticeHtml({ title, message, severity: "info" });
    text = message;
  } else if (category === "compose") {
    reconstruct = "missing-body";
  } else {
    html = buildComposeHtml({
      subject: subject || "Cursor Curse Monitor",
      body: `Replay of prior ${category} mail (${row.ts}).`,
    });
    text = `Replay of prior ${category} mail (${row.ts}).`;
  }

  return {
    id: String(row.id),
    direction: "outbound",
    from: "cursor.monitor@lorapok.tech",
    to,
    subject,
    text,
    html,
    status: failed ? "failed" : "sent",
    category,
    ts: row.ts,
    sentBy: row.email ?? "resend-saved-mail.mjs",
    source: "d1",
    reconstruct,
    transport: meta.transport ?? null,
  };
}

export async function loadD1MailMessages(adminDir, { onlyFailed = false, dedupe = true, limit = 0 } = {}) {
  const where = onlyFailed ? "AND message LIKE '%failed%'" : "";
  const sql = `SELECT id, ts, level, message, meta_json, email
    FROM system_logs
    WHERE source = 'mail' ${where}
    ORDER BY ts DESC`;
  const rows = runD1Query(sql, adminDir);
  let messages = rows.map(d1RowToMessage).filter((m) => m.to && m.subject);

  if (dedupe) {
    const seen = new Set();
    messages = messages.filter((m) => {
      const key = `${m.to}|${m.subject}|${m.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (limit > 0) messages = messages.slice(0, limit);
  return messages;
}

export function extractLocalPart(fromEmail) {
  const email = String(fromEmail ?? "").trim().toLowerCase();
  const bare = email.includes("@") ? email.split("@")[0] : "";
  return bare || null;
}

export function isReplayable(message) {
  const to = String(message?.to ?? "").trim();
  const subject = String(message?.subject ?? "").trim();
  const text = String(message?.text ?? "").trim();
  const html = String(message?.html ?? "").trim();
  if (!to || !subject) return { ok: false, reason: "missing to or subject" };
  if (message.reconstruct === "missing-body") return { ok: false, reason: "compose body not stored in D1" };
  if (!text && !html) return { ok: false, reason: "missing body" };
  if (message.direction === "inbound") return { ok: false, reason: "inbound message" };
  return { ok: true };
}

export function buildReplayPayload(message, redirectTo) {
  const text = String(message.text ?? "").trim();
  const html = String(message.html ?? "").trim() || buildComposeHtml({ subject: message.subject, body: text });
  const to = redirectTo || String(message.to ?? "").trim().toLowerCase();
  const fromEmail = String(message.from ?? "").trim();

  return {
    to,
    subject: String(message.subject ?? "").trim(),
    html,
    text: text || message.subject,
    category: message.category ?? "compose",
    sentBy: message.sentBy ?? "resend-saved-mail.mjs",
    from: fromEmail || undefined,
    fromLocalPart: fromEmail ? extractLocalPart(fromEmail) : null,
  };
}

export async function loadMailboxReplayMessages(env, { onlyFailed = false, onlyOutbound = true } = {}) {
  let mailboxRows = await listMailboxMessages(env, {});
  if (onlyOutbound) {
    mailboxRows = mailboxRows.filter((m) => m.direction === "outbound");
  }
  if (onlyFailed) {
    mailboxRows = mailboxRows.filter((m) => m.status === "failed");
  }
  return mailboxRows.map((row) => ({ ...row, source: "mailbox" }));
}

export async function listAuditSummary(kv) {
  const records = await listScatterRecords(kv, MAIL_AUDIT_RESEND_PREFIX, { limit: 1000 });
  return {
    count: records.length,
    sample: records.slice(0, 5).map((row) => ({
      id: row.id,
      ts: row.ts,
      status: row.status,
      from: row.from,
      to: row.to,
      subjectPreview: row.subjectPreview,
      transport: row.transport,
    })),
  };
}

export { maskEmail, maskEmailDisplay };
