import { MAX_MAILBOX_MESSAGES } from "./kv-limits.js";
import { isAdminD1Available } from "./d1-system-log.js";

/**
 * @param {Record<string, unknown>} row
 */
export function d1RowToMailboxMessage(row) {
  return {
    id: String(row.id),
    direction: String(row.direction),
    from: String(row.from_addr),
    to: String(row.to_addr),
    subject: String(row.subject ?? ""),
    text: String(row.text_body ?? ""),
    html: String(row.html_body ?? ""),
    status: String(row.status),
    category: String(row.category),
    ts: String(row.ts),
    sentBy: row.sent_by == null ? null : String(row.sent_by),
    error: row.error == null ? null : String(row.error),
    read: Number(row.read_flag) === 1,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} entry
 */
export async function insertMailMessageD1(env, entry) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) return false;

  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO mail_messages
         (id, ts, direction, from_addr, to_addr, subject, text_body, html_body, status, category, sent_by, error, read_flag)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.id,
        entry.ts,
        entry.direction,
        entry.from,
        entry.to,
        entry.subject,
        entry.text ?? "",
        entry.html ?? "",
        entry.status,
        entry.category,
        entry.sentBy ?? null,
        entry.error ?? null,
        entry.read ? 1 : 0
      )
      .run();
    return true;
  } catch (err) {
    console.error("insertMailMessageD1 failed", err);
    return false;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} id
 * @param {{ read?: boolean }} patch
 */
export async function patchMailMessageD1(env, id, patch) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) return null;

  if (typeof patch.read !== "boolean") return null;

  try {
    await db
      .prepare(`UPDATE mail_messages SET read_flag = ? WHERE id = ?`)
      .bind(patch.read ? 1 : 0, id)
      .run();

    const row = await db
      .prepare(
        `SELECT id, ts, direction, from_addr, to_addr, subject, text_body, html_body, status, category, sent_by, error, read_flag
         FROM mail_messages WHERE id = ?`
      )
      .bind(id)
      .first();

    return row ? d1RowToMailboxMessage(row) : null;
  } catch (err) {
    console.error("patchMailMessageD1 failed", err);
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ direction?: string; category?: string; status?: string; q?: string; unreadOnly?: boolean }} filters
 */
export async function listMailMessagesD1(env, filters = {}) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) return null;

  const clauses = [];
  const binds = [];

  if (filters.direction) {
    clauses.push("direction = ?");
    binds.push(filters.direction);
  }
  if (filters.category) {
    clauses.push("category = ?");
    binds.push(filters.category);
  }
  if (filters.status) {
    clauses.push("status = ?");
    binds.push(filters.status);
  }
  if (filters.unreadOnly) {
    clauses.push("read_flag = 0");
  }
  if (filters.q) {
    const q = `%${filters.q.toLowerCase()}%`;
    clauses.push(
      "(LOWER(subject) LIKE ? OR LOWER(to_addr) LIKE ? OR LOWER(from_addr) LIKE ? OR LOWER(text_body) LIKE ?)"
    );
    binds.push(q, q, q, q);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT id, ts, direction, from_addr, to_addr, subject, text_body, html_body, status, category, sent_by, error, read_flag
               FROM mail_messages ${where}
               ORDER BY ts DESC
               LIMIT ?`;
  binds.push(MAX_MAILBOX_MESSAGES);

  try {
    const result = await db.prepare(sql).bind(...binds).all();
    return (result?.results ?? []).map((row) => d1RowToMailboxMessage(row));
  } catch (err) {
    console.error("listMailMessagesD1 failed", err);
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 */
export async function getMailboxStatsD1(env) {
  const items = await listMailMessagesD1(env, {});
  if (!items) return null;
  return {
    total: items.length,
    unread: items.filter((m) => !m.read).length,
    outbound: items.filter((m) => m.direction === "outbound").length,
    inbound: items.filter((m) => m.direction === "inbound").length,
    failed: items.filter((m) => m.status === "failed").length,
  };
}

export { isAdminD1Available };
