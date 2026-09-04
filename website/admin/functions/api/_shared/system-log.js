import { ensureKvBackupPoint } from "./kv-backup.js";
import { listScatterRecords, putScatterRecord } from "./kv-scatter.js";
import { MAX_SYSTEM_LOG_ENTRIES, SYSTEM_LOG_TTL_SECONDS } from "./kv-limits.js";
import {
  insertSystemLogD1,
  isAdminD1Available,
  mergeSystemLogEntries,
  normalizeSystemLogEntry,
  readSystemLogsD1,
} from "./d1-system-log.js";

const SYSTEM_LOG_PREFIX = "system:log";
const LEGACY_SYSTEM_LOG_KEY = "system:logs";

/**
 * Snapshot legacy blob before scatter migration (never deletes source).
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} [triggeredBy]
 */
async function backupLegacySystemLogIfPresent(kv, triggeredBy = "system-log") {
  if (!kv?.get) return;
  try {
    const raw = await kv.get(LEGACY_SYSTEM_LOG_KEY);
    if (!raw) return;
    await ensureKvBackupPoint(kv, LEGACY_SYSTEM_LOG_KEY, {
      reason: "system-log-legacy-snapshot",
      triggeredBy,
    });
  } catch (err) {
    console.error("backupLegacySystemLogIfPresent failed", err);
  }
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 */
async function readLegacySystemLogs(kv) {
  if (!kv?.get) return [];
  try {
    const raw = await kv.get(LEGACY_SYSTEM_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    void backupLegacySystemLogIfPresent(kv, "readSystemLogs");
    return parsed.map((row) => normalizeSystemLogEntry(row));
  } catch (err) {
    console.error("readSystemLogs legacy read failed", err);
    return [];
  }
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 */
async function readScatterSystemLogs(kv) {
  if (!kv?.get) return [];
  try {
    const scatter = await listScatterRecords(kv, SYSTEM_LOG_PREFIX, { limit: MAX_SYSTEM_LOG_ENTRIES });
    return scatter.map((row) => normalizeSystemLogEntry(row));
  } catch (err) {
    console.error("readSystemLogs scatter list failed", err);
    return [];
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ level?: string; source: string; message: string; meta?: Record<string, unknown>; email?: string | null }} entry
 */
export async function logSystemEvent(env, entry) {
  if (isAdminD1Available(env)) {
    const ok = await insertSystemLogD1(env, entry);
    if (ok) return;
  }

  const kv = env?.ADMIN_KV;
  if (!kv?.put) return;

  try {
    await backupLegacySystemLogIfPresent(kv, "logSystemEvent");
    const id = crypto.randomUUID();
    await putScatterRecord(
      kv,
      SYSTEM_LOG_PREFIX,
      id,
      normalizeSystemLogEntry({
        id,
        ts: new Date().toISOString(),
        level: entry.level ?? "info",
        source: entry.source,
        message: entry.message,
        meta: entry.meta ?? {},
        email: entry.email ?? null,
      }),
      { ts: Date.now(), expirationTtl: SYSTEM_LOG_TTL_SECONDS }
    );
  } catch (err) {
    console.error("logSystemEvent failed", err);
  }
}

/** @param {Record<string, unknown>} env */
export async function readSystemLogs(env) {
  const kv = env?.ADMIN_KV;
  const d1Logs = isAdminD1Available(env) ? await readSystemLogsD1(env) : null;
  const scatter = await readScatterSystemLogs(kv);
  const legacy = await readLegacySystemLogs(kv);

  if (d1Logs) {
    return mergeSystemLogEntries(d1Logs, scatter, legacy);
  }

  if (!scatter.length) return legacy.slice(0, MAX_SYSTEM_LOG_ENTRIES);
  if (!legacy.length) return scatter.slice(0, MAX_SYSTEM_LOG_ENTRIES);

  return mergeSystemLogEntries(scatter, legacy);
}
