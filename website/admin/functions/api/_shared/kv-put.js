/**
 * KV write helpers — skip unchanged values to stay under Cloudflare daily put limits.
 */

import { formatKvQuotaError, isKvQuotaError } from "./kv-quota.js";

/**
 * @param {unknown} err
 */
export function formatKvPutError(err) {
  const message = err instanceof Error ? err.message : String(err ?? "Save failed");
  if (isKvQuotaError(message)) {
    return formatKvQuotaError(err);
  }
  return message || "Save failed";
}

/**
 * Accept either a Workers env (`{ ADMIN_KV }`) or a KV namespace (legacy callers passed `env.ADMIN_KV`).
 * @param {Record<string, unknown> | import("@cloudflare/workers-types").KVNamespace | null | undefined} envOrKv
 */
export function resolveKvBinding(envOrKv) {
  if (!envOrKv || typeof envOrKv !== "object") return null;
  if ("ADMIN_KV" in envOrKv && envOrKv.ADMIN_KV) {
    return /** @type {import("@cloudflare/workers-types").KVNamespace} */ (envOrKv.ADMIN_KV);
  }
  if (typeof envOrKv.get === "function" && typeof envOrKv.put === "function") {
    return /** @type {import("@cloudflare/workers-types").KVNamespace} */ (envOrKv);
  }
  return null;
}

/**
 * @param {Record<string, unknown> | import("@cloudflare/workers-types").KVNamespace} envOrKv
 * @param {string} key
 * @param {string} value
 */
export async function putKvStringIfChanged(envOrKv, key, value) {
  const kv = resolveKvBinding(envOrKv);
  if (!kv?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const current = await kv.get(key);
  if (current === value) return false;
  await kv.put(key, value);
  return true;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {unknown} value
 */
export async function putKvJsonIfChanged(env, key, value) {
  const serialized = JSON.stringify(value);
  return putKvStringIfChanged(env, key, serialized);
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {unknown} value
 */
export async function putKvJson(envOrKv, key, value) {
  const kv = resolveKvBinding(envOrKv);
  if (!kv?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await kv.put(key, JSON.stringify(value));
}
