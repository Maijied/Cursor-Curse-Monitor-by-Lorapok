import { MAX_SYSTEM_LOG_ENTRIES } from "./kv-limits.js";

/**
 * @param {{ id?: string; ts?: string; level?: string; source: string; message: string; meta?: Record<string, unknown>; email?: string | null }} entry
 */
export function normalizeSystemLogEntry(entry) {
  return {
    id: String(entry.id ?? crypto.randomUUID()),
    ts: String(entry.ts ?? new Date().toISOString()),
    level: String(entry.level ?? "info"),
    source: String(entry.source ?? ""),
    message: String(entry.message ?? ""),
    meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
    email: entry.email ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export function isAdminD1Available(env) {
  return Boolean(env?.ADMIN_D1?.prepare);
}

/**
 * @param {ReturnType<typeof normalizeSystemLogEntry>} row
 */
export function systemLogInsertSql(row) {
  const metaJson = JSON.stringify(row.meta ?? {}).replace(/'/g, "''");
  const email = row.email == null ? "NULL" : `'${String(row.email).replace(/'/g, "''")}'`;
  return `INSERT OR IGNORE INTO system_logs (id, ts, level, source, message, meta_json, email) VALUES ('${row.id.replace(/'/g, "''")}', '${row.ts.replace(/'/g, "''")}', '${row.level.replace(/'/g, "''")}', '${row.source.replace(/'/g, "''")}', '${row.message.replace(/'/g, "''")}', '${metaJson}', ${email});`;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ level?: string; source: string; message: string; meta?: Record<string, unknown>; email?: string | null; id?: string; ts?: string }} entry
 */
export async function insertSystemLogD1(env, entry) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) return false;

  const row = normalizeSystemLogEntry(entry);
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO system_logs (id, ts, level, source, message, meta_json, email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(row.id, row.ts, row.level, row.source, row.message, JSON.stringify(row.meta), row.email)
      .run();
    return true;
  } catch (err) {
    console.error("insertSystemLogD1 failed", err);
    return false;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {number} [limit]
 * @returns {Promise<Array<ReturnType<typeof normalizeSystemLogEntry>> | null>}
 */
export async function readSystemLogsD1(env, limit = MAX_SYSTEM_LOG_ENTRIES) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) return null;

  const capped = Math.max(1, Math.min(limit, MAX_SYSTEM_LOG_ENTRIES));
  try {
    const result = await db
      .prepare(
        `SELECT id, ts, level, source, message, meta_json, email
         FROM system_logs
         ORDER BY ts DESC
         LIMIT ?`
      )
      .bind(capped)
      .all();

    return (result?.results ?? []).map((row) => {
      let meta = {};
      if (row.meta_json) {
        try {
          meta = JSON.parse(String(row.meta_json));
        } catch {
          meta = {};
        }
      }
      return normalizeSystemLogEntry({
        id: row.id,
        ts: row.ts,
        level: row.level,
        source: row.source,
        message: row.message,
        meta,
        email: row.email,
      });
    });
  } catch (err) {
    console.error("readSystemLogsD1 failed", err);
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} source
 * @param {number} [limit]
 */
export async function readSystemLogsD1BySource(env, source, limit = MAX_SYSTEM_LOG_ENTRIES) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) return null;

  const capped = Math.max(1, Math.min(limit, MAX_SYSTEM_LOG_ENTRIES));
  const safeSource = String(source ?? "").trim();
  if (!safeSource) return [];

  try {
    const result = await db
      .prepare(
        `SELECT id, ts, level, source, message, meta_json, email
         FROM system_logs
         WHERE source = ?
         ORDER BY ts DESC
         LIMIT ?`
      )
      .bind(safeSource, capped)
      .all();

    return (result?.results ?? []).map((row) => {
      let meta = {};
      if (row.meta_json) {
        try {
          meta = JSON.parse(String(row.meta_json));
        } catch {
          meta = {};
        }
      }
      return normalizeSystemLogEntry({
        id: row.id,
        ts: row.ts,
        level: row.level,
        source: row.source,
        message: row.message,
        meta,
        email: row.email,
      });
    });
  } catch (err) {
    console.error("readSystemLogsD1BySource failed", err);
    return null;
  }
}

/**
 * @param {Array<ReturnType<typeof normalizeSystemLogEntry>>} batches
 */
export function mergeSystemLogEntries(...batches) {
  const byId = new Map();
  for (const batch of batches) {
    for (const row of batch) {
      if (!row?.id) continue;
      byId.set(row.id, row);
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      const tb = Date.parse(String(b.ts ?? "")) || 0;
      const ta = Date.parse(String(a.ts ?? "")) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    })
    .slice(0, MAX_SYSTEM_LOG_ENTRIES);
}
