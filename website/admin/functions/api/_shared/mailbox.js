import {
  MAX_MAILBOX_HTML_CHARS,
  MAX_MAILBOX_MESSAGES,
  MAX_MAILBOX_TEXT_CHARS,
  truncateStoredText,
} from "./kv-limits.js";
import { backupKvBeforeWrite } from "./kv-backup.js";
import { putKvJsonIfChanged } from "./kv-put.js";
import {
  getMailboxStatsD1,
  insertMailMessageD1,
  listMailMessagesD1,
  patchMailMessageD1,
} from "./d1-mailbox.js";
import { backupMailboxPayloadR2, shouldArchiveMailToR2, writeMailOutboxArchive } from "./r2-mail.js";
import { resolveMailboxStorage } from "./mail-storage.js";

const MAILBOX_KEY = "mailbox:messages";

/**
 * @typedef {Object} MailboxMessage
 * @property {string} id
 * @property {"outbound" | "inbound"} direction
 * @property {string} from
 * @property {string} to
 * @property {string} subject
 * @property {string} text
 * @property {string} [html]
 * @property {"sent" | "failed" | "queued" | "received"} status
 * @property {"subscribe" | "invite" | "compose" | "support" | "test" | "notice" | "system"} category
 * @property {string} ts
 * @property {string} [sentBy]
 * @property {string} [error]
 * @property {boolean} read
 */

/**
 * @param {Partial<MailboxMessage>} message
 */
function slimMailboxEntry(message) {
  return {
    ...message,
    subject: truncateStoredText(message.subject, 500),
    text: truncateStoredText(message.text, MAX_MAILBOX_TEXT_CHARS),
    html: truncateStoredText(message.html, MAX_MAILBOX_HTML_CHARS),
    error: message.error ? truncateStoredText(message.error, 500) : null,
  };
}

async function readAllKv(env) {
  if (!env?.ADMIN_KV?.get) return [];
  try {
    const raw = await env.ADMIN_KV.get(MAILBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {Record<string, unknown>} env
 */
function shouldSkipKvBackup(env) {
  return env?.CCM_SKIP_KV_BACKUP === "1" || env?.CCM_SKIP_KV_BACKUP === "true";
}

/**
 * @param {Record<string, unknown>} env
 * @param {MailboxMessage[]} messages
 */
async function writeAllKv(env, messages) {
  if (!env?.ADMIN_KV?.put) return false;
  const trimmed = messages
    .sort((a, b) => Date.parse(String(b.ts ?? "")) - Date.parse(String(a.ts ?? "")))
    .slice(0, MAX_MAILBOX_MESSAGES)
    .map((row) => slimMailboxEntry(row));
  const serialized = JSON.stringify(trimmed);

  if (!shouldSkipKvBackup(env)) {
    if (shouldArchiveMailToR2(env)) {
      await backupMailboxPayloadR2(env, MAILBOX_KEY, serialized, {
        reason: "mailbox-compaction",
        triggeredBy: "writeAll",
      });
    } else {
      await backupKvBeforeWrite(env.ADMIN_KV, MAILBOX_KEY, serialized, {
        reason: "mailbox-compaction",
        triggeredBy: "writeAll",
      });
    }
  }

  return putKvJsonIfChanged(env, MAILBOX_KEY, trimmed);
}

/**
 * @param {Record<string, unknown>} env
 * @param {Partial<MailboxMessage> & Pick<MailboxMessage, "direction" | "from" | "to" | "subject" | "text" | "status" | "category">} message
 */
export async function recordMailboxMessage(env, message) {
  const entry = slimMailboxEntry({
    id: crypto.randomUUID(),
    direction: message.direction,
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html ?? "",
    status: message.status,
    category: message.category,
    ts: message.ts ?? new Date().toISOString(),
    sentBy: message.sentBy ?? null,
    error: message.error ?? null,
    read: Boolean(message.read),
  });

  const mode = resolveMailboxStorage(env);

  if (mode === "d1") {
    const ok = await insertMailMessageD1(env, entry);
    if (ok) {
      if (shouldArchiveMailToR2(env)) {
        void writeMailOutboxArchive(env, entry);
      }
      return entry;
    }
  }

  const list = await readAllKv(env);
  list.unshift(entry);
  await writeAllKv(env, list);

  if (shouldArchiveMailToR2(env)) {
    void writeMailOutboxArchive(env, entry);
  }

  return entry;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ direction?: string; category?: string; status?: string; q?: string; unreadOnly?: boolean }} filters
 */
export async function listMailboxMessages(env, filters = {}) {
  const mode = resolveMailboxStorage(env);

  if (mode === "d1") {
    const d1Items = await listMailMessagesD1(env, filters);
    if (d1Items) return d1Items;
  }

  let items = await readAllKv(env);

  if (filters.direction) {
    items = items.filter((m) => m.direction === filters.direction);
  }
  if (filters.category) {
    items = items.filter((m) => m.category === filters.category);
  }
  if (filters.status) {
    items = items.filter((m) => m.status === filters.status);
  }
  if (filters.unreadOnly) {
    items = items.filter((m) => !m.read);
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    items = items.filter(
      (m) =>
        String(m.subject ?? "").toLowerCase().includes(q) ||
        String(m.to ?? "").toLowerCase().includes(q) ||
        String(m.from ?? "").toLowerCase().includes(q) ||
        String(m.text ?? "").toLowerCase().includes(q)
    );
  }

  return items.slice(0, MAX_MAILBOX_MESSAGES);
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} id
 * @param {{ read?: boolean }} patch
 */
export async function patchMailboxMessage(env, id, patch) {
  const mode = resolveMailboxStorage(env);

  if (mode === "d1") {
    const updated = await patchMailMessageD1(env, id, patch);
    if (updated) return updated;
  }

  const list = await readAllKv(env);
  const index = list.findIndex((m) => m.id === id);
  if (index < 0) return null;

  if (typeof patch.read === "boolean") {
    list[index] = { ...list[index], read: patch.read };
  }

  const wrote = await writeAllKv(env, list);
  if (!wrote && typeof patch.read === "boolean") {
    return list[index];
  }
  return list[index];
}

export async function getMailboxStats(env) {
  const mode = resolveMailboxStorage(env);
  if (mode === "d1") {
    const stats = await getMailboxStatsD1(env);
    if (stats) return stats;
  }

  const items = await listMailboxMessages(env, {});
  return {
    total: items.length,
    unread: items.filter((m) => !m.read).length,
    outbound: items.filter((m) => m.direction === "outbound").length,
    inbound: items.filter((m) => m.direction === "inbound").length,
    failed: items.filter((m) => m.status === "failed").length,
  };
}

export { MAILBOX_KEY };
