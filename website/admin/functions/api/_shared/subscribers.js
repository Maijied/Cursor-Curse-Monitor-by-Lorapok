export const SUBSCRIBERS_KEY = "subscribers";
export const CONSENT_VERSION = "2026-08-25";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @typedef {Object} SubscriberRecord
 * @property {string} email
 * @property {string} subscribedAt
 * @property {string} source
 * @property {string | null} installId
 * @property {string} consentVersion
 */

/** @param {unknown} value */
export function normalizeEmail(value) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

/** @param {unknown} entry */
function normalizeSubscriber(entry) {
  if (typeof entry === "string") {
    const email = normalizeEmail(entry);
    if (!email) return null;
    return {
      email,
      subscribedAt: new Date(0).toISOString(),
      source: "legacy",
      installId: null,
      consentVersion: CONSENT_VERSION,
    };
  }
  if (!entry || typeof entry !== "object") return null;
  const email = normalizeEmail(entry.email);
  if (!email) return null;
  const installIdRaw = entry.installId ?? entry.install_id ?? null;
  const installId =
    typeof installIdRaw === "string" && /^[0-9a-f-]{36}$/i.test(installIdRaw.trim())
      ? installIdRaw.trim().toLowerCase()
      : null;
  return {
    email,
    subscribedAt: String(entry.subscribedAt ?? entry.subscribed_at ?? new Date().toISOString()),
    source: String(entry.source ?? "website").trim() || "website",
    installId,
    consentVersion: String(entry.consentVersion ?? entry.consent_version ?? CONSENT_VERSION),
  };
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv */
export async function readSubscribers(kv) {
  if (!kv?.get) return [];
  try {
    const raw = await kv.get(SUBSCRIBERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSubscriber).filter(Boolean);
  } catch {
    return [];
  }
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv @param {SubscriberRecord[]} items */
export async function writeSubscribers(kv, items) {
  if (!kv?.put) return false;
  const byEmail = new Map();
  for (const item of items) {
    const normalized = normalizeSubscriber(item);
    if (!normalized) continue;
    byEmail.set(normalized.email, normalized);
  }
  const sorted = [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
  await kv.put(SUBSCRIBERS_KEY, JSON.stringify(sorted));
  return true;
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {{ email: string, source?: string, installId?: string | null, consentVersion?: string }} input
 */
export async function upsertSubscriber(kv, input) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Valid email is required" };

  const subscribers = await readSubscribers(kv);
  const existing = subscribers.find((row) => row.email === email);
  const next = {
    email,
    subscribedAt: existing?.subscribedAt ?? new Date().toISOString(),
    source: String(input.source ?? existing?.source ?? "website").trim() || "website",
    installId: input.installId ?? existing?.installId ?? null,
    consentVersion: input.consentVersion ?? CONSENT_VERSION,
  };

  const merged = [next, ...subscribers.filter((row) => row.email !== email)];
  const stored = await writeSubscribers(kv, merged);
  if (!stored) return { ok: false, error: "Subscriber storage unavailable" };

  return { ok: true, subscriber: next, alreadySubscribed: Boolean(existing) };
}

/** @param {SubscriberRecord[]} items */
export function subscriberStats(items) {
  const bySource = {};
  for (const row of items) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
  }
  return {
    total: items.length,
    bySource,
    withInstallId: items.filter((row) => row.installId).length,
  };
}
