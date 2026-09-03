import { reverseSortToken } from "./kv-scatter.js";

export const BACKUP_POINT_PREFIX = "backup:point";
export const BACKUP_INDEX_PREFIX = "backup:index";

/**
 * @param {string} sourceKey
 */
export function backupSourceSlug(sourceKey) {
  return String(sourceKey).replace(/:/g, "-");
}

/**
 * @param {string} sourceKey
 * @param {number} [ts]
 */
export function backupPointKey(sourceKey, ts = Date.now()) {
  return `${BACKUP_POINT_PREFIX}:${reverseSortToken(ts)}:${backupSourceSlug(sourceKey)}`;
}

/**
 * @param {string} sourceKey
 */
export function backupIndexKey(sourceKey) {
  return `${BACKUP_INDEX_PREFIX}:${backupSourceSlug(sourceKey)}`;
}

/**
 * @param {string} value
 */
async function digestPayload(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} sourceKey
 */
async function readBackupIndex(kv, sourceKey) {
  if (!kv?.get) return null;
  try {
    const raw = await kv.get(backupIndexKey(sourceKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Create an immutable backup point for a KV key before compaction or migration.
 * Never deletes the source key.
 *
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} sourceKey
 * @param {{ reason?: string; triggeredBy?: string }} [options]
 */
export async function ensureKvBackupPoint(kv, sourceKey, options = {}) {
  if (!kv?.get || !kv?.put) {
    return { backedUp: false, reason: "kv-unavailable" };
  }

  const raw = await kv.get(sourceKey);
  if (!raw) {
    return { backedUp: false, reason: "missing" };
  }

  const payloadHash = await digestPayload(raw);
  const index = await readBackupIndex(kv, sourceKey);
  if (index?.payloadHash === payloadHash && index?.latestKey) {
    return { backedUp: false, reason: "unchanged", backupKey: index.latestKey, byteLength: raw.length };
  }

  const key = backupPointKey(sourceKey);
  const envelope = {
    schemaVersion: 1,
    sourceKey,
    backupKey: key,
    backedUpAt: new Date().toISOString(),
    reason: options.reason ?? "snapshot",
    triggeredBy: options.triggeredBy ?? "system",
    byteLength: raw.length,
    payloadHash,
    payload: raw,
  };

  await kv.put(key, JSON.stringify(envelope));
  await kv.put(
    backupIndexKey(sourceKey),
    JSON.stringify({
      latestKey: key,
      backedUpAt: envelope.backedUpAt,
      payloadHash,
      byteLength: raw.length,
      reason: envelope.reason,
    })
  );

  return { backedUp: true, backupKey: key, byteLength: raw.length };
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} [sourceKey]
 */
export async function listKvBackupPoints(kv, sourceKey) {
  if (!kv?.list) return [];
  const prefix = sourceKey
    ? `${BACKUP_POINT_PREFIX}:`
    : `${BACKUP_POINT_PREFIX}:`;
  const slug = sourceKey ? backupSourceSlug(sourceKey) : null;
  const listed = await kv.list({ prefix, limit: 100 });
  const points = await Promise.all(
    listed.keys
      .filter(({ name }) => !slug || name.endsWith(`:${slug}`))
      .map(async ({ name }) => {
        const raw = await kv.get(name);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          return {
            backupKey: name,
            sourceKey: parsed.sourceKey ?? sourceKey ?? null,
            backedUpAt: parsed.backedUpAt ?? null,
            reason: parsed.reason ?? null,
            byteLength: parsed.byteLength ?? raw.length,
            triggeredBy: parsed.triggeredBy ?? null,
          };
        } catch {
          return null;
        }
      })
  );
  return points
    .filter(Boolean)
    .sort((a, b) => String(b.backupKey).localeCompare(String(a.backupKey)));
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} backupKey
 */
export async function readKvBackupPoint(kv, backupKey) {
  if (!kv?.get) return null;
  const raw = await kv.get(backupKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Backup the current value, then allow callers to mutate the live key.
 *
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} sourceKey
 * @param {string} nextSerialized
 * @param {{ reason?: string; triggeredBy?: string }} [options]
 */
export async function backupKvBeforeWrite(kv, sourceKey, nextSerialized, options = {}) {
  if (!kv?.get) return { backup: { backedUp: false, reason: "kv-unavailable" }, shouldWrite: true };

  const current = await kv.get(sourceKey);
  if (!current || current === nextSerialized) {
    return { backup: { backedUp: false, reason: current ? "unchanged" : "missing" }, shouldWrite: true };
  }

  const backup = await ensureKvBackupPoint(kv, sourceKey, options);
  return { backup, shouldWrite: true };
}
