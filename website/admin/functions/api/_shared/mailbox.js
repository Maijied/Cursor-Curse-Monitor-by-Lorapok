import {
  MAX_MAILBOX_HTML_CHARS,
  MAX_MAILBOX_MESSAGES,
  MAX_MAILBOX_TEXT_CHARS,
  truncateStoredText,
} from "./kv-limits.js";
import { backupKvBeforeWrite } from "./kv-backup.js";
import { putKvJsonIfChanged } from "./kv-put.js";

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

async function readAll(env) {
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
 * @param {MailboxMessage[]} messages
 */
async function writeAll(env, messages) {
  if (!env?.ADMIN_KV?.put) return false;
  const trimmed = messages
    .sort((a, b) => Date.parse(String(b.ts ?? "")) - Date.parse(String(a.ts ?? "")))
    .slice(0, MAX_MAILBOX_MESSAGES)
    .map((row) => slimMailboxEntry(row));
  const serialized = JSON.stringify(trimmed);
  await backupKvBeforeWrite(env.ADMIN_KV, MAILBOX_KEY, serialized, {
    reason: "mailbox-compaction",
    triggeredBy: "writeAll",
  });
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

  const list = await readAll(env);
  list.unshift(entry);
  await writeAll(env, list);
  return entry;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ direction?: string; category?: string; status?: string; q?: string; unreadOnly?: boolean }} filters
 */
export async function listMailboxMessages(env, filters = {}) {
  let items = await readAll(env);

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
 * @param {{ read?: boolean; status?: MailboxMessage["status"]; error?: string | null; retriedAt?: string | null }} patch
 */
export async function patchMailboxMessage(env, id, patch) {
  const list = await readAll(env);
  const index = list.findIndex((m) => m.id === id);
  if (index < 0) return null;

  const next = { ...list[index] };
  if (typeof patch.read === "boolean") next.read = patch.read;
  if (patch.status) next.status = patch.status;
  if (patch.error !== undefined) next.error = patch.error;
  if (patch.retriedAt !== undefined) next.retriedAt = patch.retriedAt;

  list[index] = next;

  const wrote = await writeAll(env, list);
  if (!wrote && Object.keys(patch).length > 0) {
    return list[index];
  }
  return list[index];
}

export async function getMailboxStats(env) {
  const items = await listMailboxMessages(env, {});
  return {
    total: items.length,
    unread: items.filter((m) => !m.read).length,
    outbound: items.filter((m) => m.direction === "outbound").length,
    inbound: items.filter((m) => m.direction === "inbound").length,
    failed: items.filter((m) => m.status === "failed").length,
  };
}
