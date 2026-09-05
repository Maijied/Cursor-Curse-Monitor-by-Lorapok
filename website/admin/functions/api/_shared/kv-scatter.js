/**
 * Scatter-gather KV writes — industry append-only pattern for Cloudflare KV.
 *
 * Instead of read-modify-write on a single growing JSON blob (O(n) payload, 2+ ops
 * per event, race-prone), each record gets its own key. Listing uses KV.list() by
 * prefix; keys embed a reverse timestamp so lexical sort ≈ newest-first.
 */

/** @param {number} [ts] */
export function reverseSortToken(ts = Date.now()) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return "000000000000000";
  return String(Math.max(0, Number.MAX_SAFE_INTEGER - Math.floor(n))).padStart(15, "0");
}

/**
 * @param {string} prefix e.g. "system:log"
 * @param {string} id stable id (uuid, email, etc.)
 * @param {number} [ts]
 */
export function scatterRecordKey(prefix, id, ts) {
  return `${prefix}:${reverseSortToken(ts)}:${id}`;
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} prefix
 * @param {string} id
 * @param {unknown} value
 * @param {{ ts?: number; expirationTtl?: number }} [options]
 */
export async function putScatterRecord(kv, prefix, id, value, options = {}) {
  if (!kv?.put) return false;
  const key = scatterRecordKey(prefix, id, options.ts);
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (options.expirationTtl) {
    await kv.put(key, serialized, { expirationTtl: options.expirationTtl });
  } else {
    await kv.put(key, serialized);
  }
  return true;
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} prefix
 * @param {{ limit?: number; cursor?: string }} [options]
 */
export async function listScatterRecords(kv, prefix, options = {}) {
  if (!kv?.list || !kv?.get) return [];
  const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
  const listed = await kv.list({ prefix: `${prefix}:`, limit, cursor: options.cursor });
  const keys = [...listed.keys].sort((a, b) => b.name.localeCompare(a.name));
  const records = await Promise.all(
    keys.map(async ({ name }) => {
      const raw = await kv.get(name);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? { ...parsed, __kvKey: name } : null;
      } catch {
        return null;
      }
    })
  );
  return records
    .filter(Boolean)
    .sort((a, b) => {
      const tb = Date.parse(String(b.ts ?? "")) || 0;
      const ta = Date.parse(String(a.ts ?? "")) || 0;
      if (tb !== ta) return tb - ta;
      return String(b.__kvKey ?? "").localeCompare(String(a.__kvKey ?? ""));
    })
    .map(({ __kvKey, ...entry }) => entry);
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} entityPrefix e.g. "subscriber:email"
 * @param {string} id
 */
export async function getScatterEntity(kv, entityPrefix, id) {
  if (!kv?.get) return null;
  const key = `${entityPrefix}:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} entityPrefix
 * @param {string} id
 * @param {unknown} value
 */
export async function putScatterEntity(kv, entityPrefix, id, value, options = {}) {
  if (!kv?.put) return false;
  const key = `${entityPrefix}:${id}`;
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (!options.skipUnchangedRead) {
    const current = await kv.get(key);
    if (current === serialized) return false;
  }
  await kv.put(key, serialized);
  return true;
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {string} entityPrefix
 * @param {{ limit?: number; maxPages?: number }} [options]
 */
export async function listScatterEntities(kv, entityPrefix, options = {}) {
  if (!kv?.list || !kv?.get) return [];
  const limit = Math.max(1, Math.min(options.limit ?? 1000, 1000));
  const maxPages = Math.max(1, options.maxPages ?? Number.POSITIVE_INFINITY);
  const records = [];
  let cursor;
  let pages = 0;

  do {
    const listed = await kv.list({ prefix: `${entityPrefix}:`, limit, cursor });
    const batch = await Promise.all(
      listed.keys.map(async ({ name }) => {
        const raw = await kv.get(name);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })
    );
    records.push(...batch.filter(Boolean));
    pages += 1;
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor && pages < maxPages);

  return records;
}
