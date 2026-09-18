/**
 * LEGAL-01 — process consent audit trail (aggregate counts only; no PII).
 */
export const PROCESS_CONSENT_VERSION = "2026-09-18";
export const CONSENT_AUDIT_KV_KEY = "consent:audit";

const MAX_DAY_KEYS = 90;

/**
 * @param {unknown} value
 * @returns {"analytics_accept"|"analytics_decline"|null}
 */
export function normalizeConsentChoice(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (raw === "analytics_accept" || raw === "accept" || raw === "allow") {
    return "analytics_accept";
  }
  if (raw === "analytics_decline" || raw === "decline" || raw === "deny" || raw === "reject") {
    return "analytics_decline";
  }
  return null;
}

/**
 * @param {unknown} stored
 */
export function emptyConsentAudit(now = new Date().toISOString()) {
  return {
    version: PROCESS_CONSENT_VERSION,
    updatedAt: now,
    totals: { analytics_accept: 0, analytics_decline: 0 },
    byDay: {},
  };
}

/**
 * @param {unknown} stored
 */
export function normalizeConsentAudit(stored) {
  const base = emptyConsentAudit();
  if (!stored || typeof stored !== "object") return base;
  const src = /** @type {Record<string, unknown>} */ (stored);
  const totalsIn = src.totals && typeof src.totals === "object" ? /** @type {Record<string, unknown>} */ (src.totals) : {};
  const byDayIn = src.byDay && typeof src.byDay === "object" ? /** @type {Record<string, unknown>} */ (src.byDay) : {};
  return {
    version: String(src.version ?? PROCESS_CONSENT_VERSION),
    updatedAt: String(src.updatedAt ?? base.updatedAt),
    totals: {
      analytics_accept: Math.max(0, Number(totalsIn.analytics_accept) || 0),
      analytics_decline: Math.max(0, Number(totalsIn.analytics_decline) || 0),
    },
    byDay: Object.fromEntries(
      Object.entries(byDayIn).map(([day, row]) => {
        const r = row && typeof row === "object" ? /** @type {Record<string, unknown>} */ (row) : {};
        return [
          day,
          {
            analytics_accept: Math.max(0, Number(r.analytics_accept) || 0),
            analytics_decline: Math.max(0, Number(r.analytics_decline) || 0),
          },
        ];
      })
    ),
  };
}

/**
 * @param {ReturnType<typeof normalizeConsentAudit>} audit
 * @param {"analytics_accept"|"analytics_decline"} choice
 * @param {string} [isoDay] YYYY-MM-DD
 */
export function applyConsentChoice(audit, choice, isoDay = new Date().toISOString().slice(0, 10)) {
  const next = normalizeConsentAudit(audit);
  next.totals[choice] = (next.totals[choice] || 0) + 1;
  const day = next.byDay[isoDay] || { analytics_accept: 0, analytics_decline: 0 };
  day[choice] = (day[choice] || 0) + 1;
  next.byDay[isoDay] = day;
  next.updatedAt = new Date().toISOString();
  next.version = PROCESS_CONSENT_VERSION;

  const days = Object.keys(next.byDay).sort();
  while (days.length > MAX_DAY_KEYS) {
    const drop = days.shift();
    if (drop) delete next.byDay[drop];
  }
  return next;
}

/**
 * @param {{ ADMIN_KV?: { get: Function, put: Function } }} env
 * @param {"analytics_accept"|"analytics_decline"} choice
 */
export async function recordConsentChoice(env, choice) {
  const kv = env?.ADMIN_KV;
  if (!kv?.get || !kv?.put) {
    return { ok: false, error: "ADMIN_KV unavailable", audit: emptyConsentAudit() };
  }
  let stored = null;
  try {
    stored = await kv.get(CONSENT_AUDIT_KV_KEY, "json");
  } catch {
    stored = null;
  }
  const audit = applyConsentChoice(normalizeConsentAudit(stored), choice);
  try {
    await kv.put(CONSENT_AUDIT_KV_KEY, JSON.stringify(audit));
  } catch (error) {
    const msg = String(error instanceof Error ? error.message : error);
    if (msg.includes("KV put() limit")) {
      return { ok: false, error: "KV put() limit", audit };
    }
    throw error;
  }
  return { ok: true, audit };
}
