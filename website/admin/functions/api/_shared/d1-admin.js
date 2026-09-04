/**
 * ADMIN_D1 connectivity probe (Phase 2 storage — logs + subscriber index).
 *
 * @param {Record<string, unknown>} env
 * @returns {Promise<{ configured: boolean; ok: boolean; error?: string }>}
 */
export async function probeAdminD1(env) {
  const db = env?.ADMIN_D1;
  if (!db?.prepare) {
    return { configured: false, ok: false, error: "ADMIN_D1 binding missing" };
  }

  try {
    const row = await db.prepare("SELECT 1 AS ok").first();
    return { configured: true, ok: row?.ok === 1 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { configured: true, ok: false, error: message };
  }
}
