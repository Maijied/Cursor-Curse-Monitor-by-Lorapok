import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:reindex";

/** @typedef {"live" | "quit-first"} ReindexWritePolicy */

export const DEFAULT_REINDEX_CONFIG = {
  /** When false, the extension hides reindex actions and blocks the command. */
  reindexEnabled: true,
  /**
   * live — allow reindex from the dashboard while the editor is open (creates backups first).
   * quit-first — require a fully quit editor before writing (safest; legacy behavior).
   */
  reindexWritePolicy: /** @type {ReindexWritePolicy} */ ("live"),
};

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeReindexConfig(parsed) {
  const policy =
    parsed.reindexWritePolicy === "quit-first" ? "quit-first" : "live";
  return {
    reindexEnabled: parsed.reindexEnabled !== false,
    reindexWritePolicy: policy,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readReindexConfig(env) {
  if (!env?.ADMIN_KV?.get) return { ...DEFAULT_REINDEX_CONFIG };
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_REINDEX_CONFIG };
    return normalizeReindexConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_REINDEX_CONFIG };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} patch
 */
export async function writeReindexConfig(env, patch) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const current = await readReindexConfig(env);
  const next = normalizeReindexConfig({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy ?? current.updatedBy ?? null,
  });
  await putKvJsonIfChanged(env, CONFIG_KEY, next);
  return next;
}

/**
 * @param {ReturnType<typeof normalizeReindexConfig>} config
 */
export function sanitizeReindexConfigForClient(config) {
  return {
    reindexEnabled: config.reindexEnabled,
    reindexWritePolicy: config.reindexWritePolicy,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

/**
 * Public, secret-free reindex policy for the IDE extension.
 * @param {ReturnType<typeof normalizeReindexConfig>} config
 */
export function buildPublicReindexPolicy(config) {
  return {
    reindexEnabled: config.reindexEnabled,
    reindexWritePolicy: config.reindexWritePolicy,
    requireEditorQuit: config.reindexWritePolicy === "quit-first",
  };
}
