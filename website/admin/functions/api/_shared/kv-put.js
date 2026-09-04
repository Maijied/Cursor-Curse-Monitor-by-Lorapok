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
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {string} value
 */
export async function putKvStringIfChanged(env, key, value) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const current = await env.ADMIN_KV.get(key);
  if (current === value) return false;
  await env.ADMIN_KV.put(key, value);
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
export async function putKvJson(env, key, value) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await env.ADMIN_KV.put(key, JSON.stringify(value));
}
