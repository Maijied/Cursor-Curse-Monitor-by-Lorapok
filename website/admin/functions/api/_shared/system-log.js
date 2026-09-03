import { ensureKvBackupPoint } from "./kv-backup.js";
import { listScatterRecords, putScatterRecord } from "./kv-scatter.js";
import { MAX_SYSTEM_LOG_ENTRIES, SYSTEM_LOG_TTL_SECONDS } from "./kv-limits.js";

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
 * @param {Record<string, unknown>} env
 * @param {{ level?: string; source: string; message: string; meta?: Record<string, unknown>; email?: string | null }} entry
 */
export async function logSystemEvent(env, entry) {
  const kv = env?.ADMIN_KV;
  if (!kv?.put) return;

  try {
    await backupLegacySystemLogIfPresent(kv, "logSystemEvent");
    const id = crypto.randomUUID();
    await putScatterRecord(
      kv,
      SYSTEM_LOG_PREFIX,
      id,
      {
        id,
        ts: new Date().toISOString(),
        level: entry.level ?? "info",
        source: entry.source,
        message: entry.message,
        meta: entry.meta ?? {},
        email: entry.email ?? null,
      },
      { ts: Date.now(), expirationTtl: SYSTEM_LOG_TTL_SECONDS }
    );
  } catch (err) {
    console.error("logSystemEvent failed", err);
  }
}

/** @param {Record<string, unknown>} env */
export async function readSystemLogs(env) {
  const kv = env?.ADMIN_KV;
  if (!kv?.get) return [];

  let scatter = [];
  try {
    scatter = await listScatterRecords(kv, SYSTEM_LOG_PREFIX, { limit: MAX_SYSTEM_LOG_ENTRIES });
  } catch (err) {
    console.error("readSystemLogs scatter list failed", err);
  }

  let legacy = [];
  try {
    const raw = await kv.get(LEGACY_SYSTEM_LOG_KEY);
    if (!raw) return scatter.slice(0, MAX_SYSTEM_LOG_ENTRIES);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) legacy = parsed;
    void backupLegacySystemLogIfPresent(kv, "readSystemLogs");
  } catch (err) {
    console.error("readSystemLogs legacy read failed", err);
    return scatter.slice(0, MAX_SYSTEM_LOG_ENTRIES);
  }

  if (!scatter.length) return legacy.slice(0, MAX_SYSTEM_LOG_ENTRIES);
  if (!legacy.length) return scatter.slice(0, MAX_SYSTEM_LOG_ENTRIES);

  const merged = [...scatter, ...legacy]
    .sort((a, b) => {
      const tb = Date.parse(String(b.ts ?? "")) || 0;
      const ta = Date.parse(String(a.ts ?? "")) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id ?? "").localeCompare(String(a.id ?? ""));
    })
    .slice(0, MAX_SYSTEM_LOG_ENTRIES);

  return merged;
}
