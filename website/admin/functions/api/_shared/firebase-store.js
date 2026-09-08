/**
 * Firestore fallback for ADMIN_KV when daily write quota is exhausted or KV is unavailable.
 * Uses Firestore REST API + service-account JWT (jose) — no firebase-admin bundle in Workers.
 *
 * Collections (server-only via service account; client rules deny all):
 * - admin-kv-fallback/{docId} — mirrored KV string values (`data`, `updatedAt`)
 * - system-logs/{autoId} — append-only system log entries when D1/KV scatter unavailable
 */

import { SignJWT, importPKCS8 } from "jose";
import { resolveFirebaseConfigFromEnv } from "./firebase-config.js";

export const FIRESTORE_KV_COLLECTION = "admin-kv-fallback";
export const FIRESTORE_SYSTEM_LOG_COLLECTION = "system-logs";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";

/** @type {{ token: string; expiresAt: number } | null} */
let cachedAccessToken = null;

/**
 * @param {string} kvKey
 */
export function kvKeyToFirestoreDocId(kvKey) {
  const bytes = new TextEncoder().encode(kvKey);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * @param {Record<string, unknown>} env
 */
function parseServiceAccount(env) {
  const raw = env?.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.client_email || !parsed?.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 */
export function resolveFirestoreProjectId(env) {
  const fromSa = parseServiceAccount(env)?.project_id;
  if (fromSa) return String(fromSa).trim();
  const fromEnv = String(env?.FIREBASE_PROJECT_ID ?? env?.VITE_FIREBASE_PROJECT_ID ?? "").trim();
  if (fromEnv) return fromEnv;
  const config = resolveFirebaseConfigFromEnv(env);
  return config?.projectId?.trim() ?? "";
}

/**
 * @param {Record<string, unknown>} env
 */
export function isFirestoreFallbackAvailable(env) {
  const sa = parseServiceAccount(env);
  return Boolean(sa?.client_email && sa?.private_key && resolveFirestoreProjectId(env));
}

/**
 * @param {Record<string, unknown>} env
 * @param {typeof fetch} [fetchImpl]
 */
async function getFirestoreAccessToken(env, fetchImpl = fetch) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const sa = parseServiceAccount(env);
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(sa.private_key.replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({
    scope: FIRESTORE_SCOPE,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const token = typeof body?.access_token === "string" ? body.access_token : null;
  if (!token) return null;
  const expiresIn = Number(body.expires_in ?? 3600);
  cachedAccessToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

/** Clear cached OAuth token (tests only). */
export function clearFirestoreTokenCache() {
  cachedAccessToken = null;
}

/** Inject OAuth token without JWT signing (tests only). */
export function setFirestoreAccessTokenForTests(token, expiresInSec = 3600) {
  cachedAccessToken = { token, expiresAt: Date.now() + expiresInSec * 1000 };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} collection
 * @param {string} docId
 * @param {typeof fetch} [fetchImpl]
 */
function firestoreDocUrl(env, collection, docId, fetchImpl) {
  const projectId = resolveFirestoreProjectId(env);
  return `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
}

/**
 * @param {unknown} fields
 */
function readStringField(fields, name) {
  const node = fields?.[name];
  if (node && typeof node === "object" && "stringValue" in node) {
    return String(node.stringValue);
  }
  return null;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} kvKey
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string | null>}
 */
export async function getFirestoreSafe(env, kvKey, fetchImpl = fetch) {
  if (!isFirestoreFallbackAvailable(env)) return null;
  const token = await getFirestoreAccessToken(env, fetchImpl);
  if (!token) return null;

  const docId = kvKeyToFirestoreDocId(kvKey);
  const url = firestoreDocUrl(env, FIRESTORE_KV_COLLECTION, docId);
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const body = await res.json();
    return readStringField(body?.fields, "data");
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} kvKey
 * @param {typeof fetch} [fetchImpl]
 */
export async function getFirestoreJsonSafe(env, kvKey, fetchImpl = fetch) {
  const raw = await getFirestoreSafe(env, kvKey, fetchImpl);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @typedef {Object} FirestorePutResult
 * @property {boolean} ok
 * @property {boolean} wrote
 * @property {string} [reason]
 */

/**
 * @param {Record<string, unknown>} env
 * @param {string} kvKey
 * @param {string} value
 * @param {{ skipIfUnchanged?: boolean; fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<FirestorePutResult>}
 */
export async function putFirestoreSafe(env, kvKey, value, options = {}) {
  const { skipIfUnchanged = false, fetchImpl = fetch } = options;
  if (!isFirestoreFallbackAvailable(env)) {
    return { ok: false, wrote: false, reason: "firestore-unavailable" };
  }

  if (skipIfUnchanged) {
    const current = await getFirestoreSafe(env, kvKey, fetchImpl);
    if (current === value) {
      return { ok: true, wrote: false, reason: "unchanged" };
    }
  }

  const token = await getFirestoreAccessToken(env, fetchImpl);
  if (!token) {
    return { ok: false, wrote: false, reason: "firestore-auth-failed" };
  }

  const docId = kvKeyToFirestoreDocId(kvKey);
  const url = `${firestoreDocUrl(env, FIRESTORE_KV_COLLECTION, docId)}?updateMask.fieldPaths=data&updateMask.fieldPaths=updatedAt`;
  const now = new Date().toISOString();
  try {
    const res = await fetchImpl(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          data: { stringValue: value },
          kvKey: { stringValue: kvKey },
          updatedAt: { stringValue: now },
        },
      }),
    });
    if (!res.ok) {
      return { ok: false, wrote: false, reason: `firestore-http-${res.status}` };
    }
    return { ok: true, wrote: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "firestore put failed");
    return { ok: false, wrote: false, reason: message };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} kvKey
 * @param {unknown} value
 * @param {{ skipIfUnchanged?: boolean; fetchImpl?: typeof fetch }} [options]
 */
export async function putFirestoreJsonSafe(env, kvKey, value, options = {}) {
  return putFirestoreSafe(env, kvKey, JSON.stringify(value), options);
}

/**
 * Append a system log entry to Firestore when D1/KV scatter is unavailable.
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} entry
 * @param {typeof fetch} [fetchImpl]
 */
export async function appendFirestoreSystemLog(env, entry, fetchImpl = fetch) {
  if (!isFirestoreFallbackAvailable(env)) return false;
  const token = await getFirestoreAccessToken(env, fetchImpl);
  if (!token) return false;

  const projectId = resolveFirestoreProjectId(env);
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/${FIRESTORE_SYSTEM_LOG_COLLECTION}`;
  const normalized = {
    id: entry.id ?? crypto.randomUUID(),
    ts: entry.ts ?? new Date().toISOString(),
    level: entry.level ?? "info",
    source: entry.source ?? "unknown",
    message: entry.message ?? "",
    meta: entry.meta ?? {},
    email: entry.email ?? null,
  };

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          id: { stringValue: String(normalized.id) },
          ts: { stringValue: String(normalized.ts) },
          level: { stringValue: String(normalized.level) },
          source: { stringValue: String(normalized.source) },
          message: { stringValue: String(normalized.message) },
          meta: { stringValue: JSON.stringify(normalized.meta) },
          email: normalized.email ? { stringValue: String(normalized.email) } : { nullValue: null },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Read KV string with Firestore fallback (KV first, then Firestore on miss).
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {typeof fetch} [fetchImpl]
 */
export async function getKvStringWithFirestoreFallback(env, key, fetchImpl = fetch) {
  const kv = env?.ADMIN_KV;
  if (kv?.get) {
    try {
      const fromKv = await kv.get(key);
      if (fromKv) return { value: fromKv, source: "kv" };
    } catch {
      /* try firestore */
    }
  }
  const fromFs = await getFirestoreSafe(env, key, fetchImpl);
  if (fromFs) return { value: fromFs, source: "firestore" };
  return null;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {typeof fetch} [fetchImpl]
 */
export async function getKvJsonWithFirestoreFallback(env, key, fetchImpl = fetch) {
  const row = await getKvStringWithFirestoreFallback(env, key, fetchImpl);
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value), source: row.source };
  } catch {
    return null;
  }
}
