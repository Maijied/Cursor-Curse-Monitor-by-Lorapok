const SYSTEM_LOG_KEY = "system:logs";
const MAX_ENTRIES = 500;

/**
 * @param {Record<string, unknown>} env
 * @param {{ level?: string; source: string; message: string; meta?: Record<string, unknown>; email?: string | null }} entry
 */
export async function logSystemEvent(env, entry) {
  if (!env?.ADMIN_KV?.get || !env?.ADMIN_KV?.put) return;

  try {
    const raw = await env.ADMIN_KV.get(SYSTEM_LOG_KEY);
    let list = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }

    list.unshift({
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      level: entry.level ?? "info",
      source: entry.source,
      message: entry.message,
      meta: entry.meta ?? {},
      email: entry.email ?? null,
    });

    if (list.length > MAX_ENTRIES) list = list.slice(0, MAX_ENTRIES);
    await env.ADMIN_KV.put(SYSTEM_LOG_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("logSystemEvent failed", err);
  }
}

export async function readSystemLogs(env) {
  if (!env?.ADMIN_KV?.get) return [];
  try {
    const raw = await env.ADMIN_KV.get(SYSTEM_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
