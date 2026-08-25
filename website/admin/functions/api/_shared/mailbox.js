const MAILBOX_KEY = "mailbox:messages";
const MAX_MESSAGES = 500;

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

async function writeAll(env, messages) {
  if (!env?.ADMIN_KV?.put) return false;
  const trimmed = messages.slice(0, MAX_MESSAGES);
  await env.ADMIN_KV.put(MAILBOX_KEY, JSON.stringify(trimmed));
  return true;
}

/**
 * @param {Record<string, unknown>} env
 * @param {Partial<MailboxMessage> & Pick<MailboxMessage, "direction" | "from" | "to" | "subject" | "text" | "status" | "category">} message
 */
export async function recordMailboxMessage(env, message) {
  const entry = {
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
  };

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

  return items;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} id
 * @param {{ read?: boolean }} patch
 */
export async function patchMailboxMessage(env, id, patch) {
  const list = await readAll(env);
  const index = list.findIndex((m) => m.id === id);
  if (index < 0) return null;

  if (typeof patch.read === "boolean") {
    list[index] = { ...list[index], read: patch.read };
  }

  await writeAll(env, list);
  return list[index];
}

export async function getMailboxStats(env) {
  const items = await readAll(env);
  return {
    total: items.length,
    unread: items.filter((m) => !m.read).length,
    outbound: items.filter((m) => m.direction === "outbound").length,
    inbound: items.filter((m) => m.direction === "inbound").length,
    failed: items.filter((m) => m.status === "failed").length,
  };
}
