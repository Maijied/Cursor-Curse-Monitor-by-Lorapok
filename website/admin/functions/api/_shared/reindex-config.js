/** @deprecated Use cursor-index-config.js — kept for legacy /integrations/reindex routes. */
import {
  DEFAULT_CURSOR_INDEX_CONFIG,
  buildPublicCursorIndexPolicy,
  normalizeCursorIndexConfig,
  readCursorIndexConfig,
  sanitizeCursorIndexConfigForClient,
  writeCursorIndexConfig,
} from "./cursor-index-config.js";

export const DEFAULT_REINDEX_CONFIG = DEFAULT_CURSOR_INDEX_CONFIG;

export function normalizeReindexConfig(parsed) {
  const normalized = normalizeCursorIndexConfig(parsed);
  return {
    ...normalized,
    reindexEnabled: normalized.indexEnabled,
    reindexWritePolicy: normalized.indexWritePolicy,
  };
}

export async function readReindexConfig(env) {
  return readCursorIndexConfig(env);
}

export async function writeReindexConfig(env, patch) {
  return writeCursorIndexConfig(env, {
    indexEnabled: patch.reindexEnabled,
    indexWritePolicy: patch.reindexWritePolicy,
    updatedBy: patch.updatedBy,
  });
}

export function sanitizeReindexConfigForClient(config) {
  const sanitized = sanitizeCursorIndexConfigForClient(config);
  return {
    reindexEnabled: sanitized.indexEnabled,
    reindexWritePolicy: sanitized.indexWritePolicy,
    updatedAt: sanitized.updatedAt,
    updatedBy: sanitized.updatedBy,
  };
}

export function buildPublicReindexPolicy(config) {
  return buildPublicCursorIndexPolicy(config);
}
