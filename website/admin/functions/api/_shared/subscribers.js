import { formatKvQuotaError, isKvQuotaError, kvQuotaKind } from "./kv-quota.js";
import {
  listSubscribersD1,
  readSubscriberD1,
  upsertSubscriberD1,
} from "./d1-subscribers.js";
import {
  getScatterEntity,
  listScatterEntities,
  putScatterEntity,
} from "./kv-scatter.js";

export const SUBSCRIBERS_KEY = "subscribers";
export const SUBSCRIBERS_SNAPSHOT_KEY = "subscribers:snapshot:v1";
export const SUBSCRIBER_EMAIL_PREFIX = "subscriber:email";
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

/** @param {SubscriberRecord[]} items */
function sortSubscribers(items) {
  return [...items].sort((a, b) => a.email.localeCompare(b.email));
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv */
async function readLegacySubscribers(kv) {
  if (!kv?.get) return [];
  try {
    const raw = await kv.get(SUBSCRIBERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSubscriber).filter(Boolean);
  } catch (error) {
    if (isKvQuotaError(error)) throw error;
    return [];
  }
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv */
async function readSubscriberSnapshot(kv) {
  if (!kv?.get) return null;
  try {
    const raw = await kv.get(SUBSCRIBERS_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items = parsed.map(normalizeSubscriber).filter(Boolean);
    return items.length ? items : null;
  } catch (error) {
    if (isKvQuotaError(error)) {
      console.warn("subscribers: snapshot read skipped (KV quota)", error);
      return null;
    }
    return null;
  }
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv @param {SubscriberRecord[]} items */
async function writeSubscriberSnapshot(kv, items) {
  if (!kv?.put || !items.length) return false;
  try {
    await kv.put(SUBSCRIBERS_SNAPSHOT_KEY, JSON.stringify(sortSubscribers(items)));
    return true;
  } catch (error) {
    if (isKvQuotaError(error)) {
      console.warn("subscribers: snapshot write skipped (KV quota)", error);
      return false;
    }
    throw error;
  }
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv */
async function rebuildSubscribersFromScatter(kv) {
  let scattered = [];
  try {
    scattered = (
      await listScatterEntities(kv, SUBSCRIBER_EMAIL_PREFIX, { limit: 1000, maxPages: 1 })
    )
      .map(normalizeSubscriber)
      .filter(Boolean);
  } catch (error) {
    console.warn("subscribers: scatter list failed", error);
    if (isKvQuotaError(error)) throw error;
  }

  const legacy = await readLegacySubscribers(kv);
  const byEmail = new Map();
  for (const row of legacy) byEmail.set(row.email, row);
  for (const row of scattered) byEmail.set(row.email, row);
  return sortSubscribers([...byEmail.values()]);
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv */
export async function readSubscribers(kv, env = null) {
  if (!kv?.get) {
    if (env) return listSubscribersD1(env);
    return [];
  }

  try {
    const snapshot = await readSubscriberSnapshot(kv);
    if (snapshot) {
      if (env) {
        const d1Rows = await listSubscribersD1(env);
        if (d1Rows.length) {
          const byEmail = new Map(snapshot.map((row) => [row.email, row]));
          for (const row of d1Rows) byEmail.set(row.email, row);
          return sortSubscribers([...byEmail.values()]);
        }
      }
      return snapshot;
    }
  } catch (error) {
    if (!isKvQuotaError(error)) throw error;
    console.warn("subscribers: snapshot read failed (KV quota)", error);
  }

  if (env) {
    const d1Rows = await listSubscribersD1(env);
    if (d1Rows.length) return sortSubscribers(d1Rows);
  }

  const merged = await rebuildSubscribersFromScatter(kv);
  if (merged.length) {
    await writeSubscriberSnapshot(kv, merged);
  }
  return merged;
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
  const rows = sortSubscribers([...byEmail.values()]);
  await Promise.all(
    rows.map((row) => putScatterEntity(kv, SUBSCRIBER_EMAIL_PREFIX, row.email, row))
  );
  await writeSubscriberSnapshot(kv, rows);
  return true;
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {{ email: string; source?: string; installId?: string | null; consentVersion?: string }} input
 * @param {{ skipSnapshot?: boolean; env?: Record<string, unknown> | null }} [options]
 */
export async function upsertSubscriber(kv, input, options = {}) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Valid email is required" };
  const env = options.env ?? null;
  const skipSnapshot = options.skipSnapshot === true;
  const canKvWrite = Boolean(kv?.put);

  let existing = null;
  if (kv?.get) {
    try {
      existing = normalizeSubscriber(await getScatterEntity(kv, SUBSCRIBER_EMAIL_PREFIX, email));
    } catch (error) {
      if (isKvQuotaError(error) && kvQuotaKind(error) === "read") {
        console.warn("subscribers: scatter read skipped (KV read quota)", error);
      } else if (isKvQuotaError(error)) {
        return { ok: false, error: formatKvQuotaError(error) };
      } else {
        throw error;
      }
    }
  }

  if (!existing && env) {
    existing = normalizeSubscriber(await readSubscriberD1(env, email));
  }

  if (!existing && kv?.get) {
    try {
      existing = (await readLegacySubscribers(kv)).find((row) => row.email === email) ?? null;
    } catch (error) {
      if (isKvQuotaError(error) && kvQuotaKind(error) === "read") {
        console.warn("subscribers: legacy read skipped (KV read quota)", error);
      } else if (isKvQuotaError(error)) {
        return { ok: false, error: formatKvQuotaError(error) };
      } else {
        throw error;
      }
    }
  }

  const next = {
    email,
    subscribedAt: existing?.subscribedAt ?? new Date().toISOString(),
    source: String(input.source ?? existing?.source ?? "website").trim() || "website",
    installId: input.installId ?? existing?.installId ?? null,
    consentVersion: input.consentVersion ?? CONSENT_VERSION,
  };

  const unchanged =
    existing &&
    existing.source === next.source &&
    existing.installId === next.installId &&
    existing.consentVersion === next.consentVersion;

  if (unchanged) {
    return {
      ok: true,
      subscriber: next,
      alreadySubscribed: true,
      kvWriteSkipped: true,
      storage: existing ? "existing" : "unknown",
    };
  }

  let wrote = false;
  let kvWriteError = null;
  if (canKvWrite) {
    try {
      wrote = await putScatterEntity(kv, SUBSCRIBER_EMAIL_PREFIX, email, next, { skipUnchangedRead: true });
    } catch (error) {
      if (isKvQuotaError(error) && kvQuotaKind(error) === "write") {
        kvWriteError = error;
        console.warn("subscribers: scatter write skipped (KV write quota)", error);
      } else if (isKvQuotaError(error)) {
        return { ok: false, error: formatKvQuotaError(error) };
      } else {
        throw error;
      }
    }
  }

  if (!skipSnapshot && canKvWrite && !kvWriteError) {
    let snapshot = null;
    try {
      snapshot = await readSubscriberSnapshot(kv);
    } catch (error) {
      if (!isKvQuotaError(error)) throw error;
      console.warn("subscribers: snapshot read skipped during upsert (KV quota)", error);
    }
    const base = snapshot ?? (existing ? [existing] : []);
    const byEmail = new Map(base.map((row) => [row.email, row]));
    byEmail.set(email, next);
    await writeSubscriberSnapshot(kv, [...byEmail.values()]);
  }

  if (!wrote && kvWriteError && env) {
    const d1 = await upsertSubscriberD1(env, next);
    if (d1.ok) {
      return {
        ok: true,
        subscriber: next,
        alreadySubscribed: Boolean(existing),
        kvWriteSkipped: true,
        storage: "d1",
      };
    }
    return { ok: false, error: formatKvQuotaError(kvWriteError) };
  }

  if (!wrote && !canKvWrite && env) {
    const d1 = await upsertSubscriberD1(env, next);
    if (d1.ok) {
      return {
        ok: true,
        subscriber: next,
        alreadySubscribed: Boolean(existing),
        kvWriteSkipped: true,
        storage: "d1",
      };
    }
    return { ok: false, error: d1.error || "Subscriber storage unavailable" };
  }

  if (kvWriteError) {
    return { ok: false, error: formatKvQuotaError(kvWriteError) };
  }

  return {
    ok: true,
    subscriber: next,
    alreadySubscribed: Boolean(existing),
    kvWriteSkipped: Boolean(existing) && wrote === false,
    storage: wrote ? "kv" : "existing",
  };
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
