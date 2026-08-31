import { listScatterRecords, putScatterRecord } from "./kv-scatter.js";

const SYSTEM_LOG_PREFIX = "system:log";
const LEGACY_SYSTEM_LOG_KEY = "system:logs";
const MAX_ENTRIES = 500;

/**
 * @param {Record<string, unknown>} env
 * @param {{ level?: string; source: string; message: string; meta?: Record<string, unknown>; email?: string | null }} entry
 */
export async function logSystemEvent(env, entry) {
  const kv = env?.ADMIN_KV;
  if (!kv?.put) return;

  try {
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
      { ts: Date.now() }
    );
  } catch (err) {
    console.error("logSystemEvent failed", err);
  }
}

/** @param {Record<string, unknown>} env */
export async function readSystemLogs(env) {
  const kv = env?.ADMIN_KV;
  if (!kv?.get) return [];

  const scatter = await listScatterRecords(kv, SYSTEM_LOG_PREFIX, { limit: MAX_ENTRIES });
  if (scatter.length) return scatter;

  try {
    const raw = await kv.get(LEGACY_SYSTEM_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}
