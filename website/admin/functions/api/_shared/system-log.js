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

  let scatter = [];
  try {
    scatter = await listScatterRecords(kv, SYSTEM_LOG_PREFIX, { limit: MAX_ENTRIES });
  } catch (err) {
    console.error("readSystemLogs scatter list failed", err);
  }

  let legacy = [];
  try {
    const raw = await kv.get(LEGACY_SYSTEM_LOG_KEY);
    if (!raw) return scatter.length ? scatter.slice(0, MAX_ENTRIES) : [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) legacy = parsed;
  } catch (err) {
    console.error("readSystemLogs legacy read failed", err);
    return scatter.slice(0, MAX_ENTRIES);
  }

  if (!scatter.length) return legacy.slice(0, MAX_ENTRIES);
  if (!legacy.length) return scatter.slice(0, MAX_ENTRIES);

  const merged = [...scatter, ...legacy]
    .sort((a, b) => {
      const tb = Date.parse(String(b.ts ?? "")) || 0;
      const ta = Date.parse(String(a.ts ?? "")) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.id ?? "").localeCompare(String(a.id ?? ""));
    })
    .slice(0, MAX_ENTRIES);

  return merged;
}
