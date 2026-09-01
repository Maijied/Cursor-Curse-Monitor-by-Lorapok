import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:cursor-index";
const LEGACY_REINDEX_KEY = "integrations:reindex";

/** @typedef {"live" | "quit-first"} CursorIndexWritePolicy */

export const DEFAULT_CURSOR_INDEX_CONFIG = {
  /** Master switch for reindex + CIP import/export UI and commands. */
  indexEnabled: true,
  /** live — write while editor open (backup first). quit-first — require fully quit editor. */
  indexWritePolicy: /** @type {CursorIndexWritePolicy} */ ("live"),
  /** Allow exporting conversation index packages (.cip.json). */
  cipExportEnabled: true,
  /** Allow importing conversation index packages into the active account. */
  cipImportEnabled: true,
  /** 0 = all transcripts; otherwise only include transcripts updated within N days. */
  transcriptLookbackDays: 0,
  /** Max transcripts processed per reindex run (0 = unlimited). */
  maxReindexRecords: 5000,
  /** Max records per export package (0 = unlimited). */
  maxExportRecords: 5000,
  /** Max records accepted per import (0 = unlimited). */
  maxImportRecords: 5000,
  /** Redact secrets before export completes. */
  cipRequireSanitization: true,
  /** When false, identical content from different owners imports as separate rows. */
  cipDedupeAcrossUsers: false,
  /** Phase 2: read another discovered product folder on the same machine. */
  cipAllowCrossUserLocalImport: false,
};

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {{ min?: number, max?: number }} bounds
 */
function clampInt(value, fallback, { min = 0, max = 100000 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(num)));
}

/**
 * @param {Record<string, unknown>} body
 * @returns {string[]}
 */
export function validateCursorIndexPatch(body) {
  const errors = [];
  if (body == null || typeof body !== "object") {
    return ["Request body must be a JSON object"];
  }

  if (
    body.indexWritePolicy !== undefined &&
    body.indexWritePolicy !== "live" &&
    body.indexWritePolicy !== "quit-first"
  ) {
    errors.push("indexWritePolicy must be live or quit-first");
  }

  const intFields = [
    { name: "transcriptLookbackDays", max: 3650 },
    { name: "maxReindexRecords", max: 100000 },
    { name: "maxExportRecords", max: 100000 },
    { name: "maxImportRecords", max: 100000 },
  ];

  for (const { name, max } of intFields) {
    if (body[name] === undefined) continue;
    const num = Number(body[name]);
    if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
      errors.push(`${name} must be a non-negative integer`);
      continue;
    }
    if (num > max) {
      errors.push(`${name} must be at most ${max}`);
    }
  }

  const boolFields = [
    "indexEnabled",
    "cipExportEnabled",
    "cipImportEnabled",
    "cipRequireSanitization",
    "cipDedupeAcrossUsers",
    "cipAllowCrossUserLocalImport",
  ];
  for (const field of boolFields) {
    if (body[field] !== undefined && typeof body[field] !== "boolean") {
      errors.push(`${field} must be a boolean`);
    }
  }

  return errors;
}

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeCursorIndexConfig(parsed) {
  const writePolicy = parsed.indexWritePolicy === "quit-first" || parsed.reindexWritePolicy === "quit-first"
    ? "quit-first"
    : "live";
  const indexEnabled =
    parsed.indexEnabled !== false &&
    parsed.reindexEnabled !== false &&
    parsed.cipEnabled !== false;

  return {
    indexEnabled,
    indexWritePolicy: writePolicy,
    cipExportEnabled: parsed.cipExportEnabled !== false,
    cipImportEnabled: parsed.cipImportEnabled !== false,
    transcriptLookbackDays: clampInt(parsed.transcriptLookbackDays, DEFAULT_CURSOR_INDEX_CONFIG.transcriptLookbackDays, {
      min: 0,
      max: 3650,
    }),
    maxReindexRecords: clampInt(parsed.maxReindexRecords, DEFAULT_CURSOR_INDEX_CONFIG.maxReindexRecords, {
      min: 0,
      max: 100000,
    }),
    maxExportRecords: clampInt(parsed.maxExportRecords, DEFAULT_CURSOR_INDEX_CONFIG.maxExportRecords, {
      min: 0,
      max: 100000,
    }),
    maxImportRecords: clampInt(parsed.maxImportRecords, DEFAULT_CURSOR_INDEX_CONFIG.maxImportRecords, {
      min: 0,
      max: 100000,
    }),
    cipRequireSanitization: parsed.cipRequireSanitization !== false,
    cipDedupeAcrossUsers: parsed.cipDedupeAcrossUsers === true,
    cipAllowCrossUserLocalImport: parsed.cipAllowCrossUserLocalImport === true,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readCursorIndexConfig(env) {
  if (!env?.ADMIN_KV?.get) return { ...DEFAULT_CURSOR_INDEX_CONFIG };
  try {
    let raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) {
      raw = await env.ADMIN_KV.get(LEGACY_REINDEX_KEY);
    }
    if (!raw) return { ...DEFAULT_CURSOR_INDEX_CONFIG };
    return normalizeCursorIndexConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CURSOR_INDEX_CONFIG };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} patch
 */
export async function writeCursorIndexConfig(env, patch) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const current = await readCursorIndexConfig(env);
  const next = normalizeCursorIndexConfig({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy ?? current.updatedBy ?? null,
  });
  await putKvJsonIfChanged(env, CONFIG_KEY, next);
  return next;
}

/**
 * @param {ReturnType<typeof normalizeCursorIndexConfig>} config
 */
export function sanitizeCursorIndexConfigForClient(config) {
  return {
    indexEnabled: config.indexEnabled,
    indexWritePolicy: config.indexWritePolicy,
    cipExportEnabled: config.cipExportEnabled,
    cipImportEnabled: config.cipImportEnabled,
    transcriptLookbackDays: config.transcriptLookbackDays,
    maxReindexRecords: config.maxReindexRecords,
    maxExportRecords: config.maxExportRecords,
    maxImportRecords: config.maxImportRecords,
    cipRequireSanitization: config.cipRequireSanitization,
    cipDedupeAcrossUsers: config.cipDedupeAcrossUsers,
    cipAllowCrossUserLocalImport: config.cipAllowCrossUserLocalImport,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

/**
 * Public, secret-free cursor index policy for IDE extension and marketing site.
 * @param {ReturnType<typeof normalizeCursorIndexConfig>} config
 */
export function buildPublicCursorIndexPolicy(config) {
  return {
    indexEnabled: config.indexEnabled,
    indexWritePolicy: config.indexWritePolicy,
    requireEditorQuit: config.indexWritePolicy === "quit-first",
    reindexEnabled: config.indexEnabled,
    reindexWritePolicy: config.indexWritePolicy,
    cipEnabled: config.indexEnabled && (config.cipExportEnabled || config.cipImportEnabled),
    cipExportEnabled: config.cipExportEnabled,
    cipImportEnabled: config.cipImportEnabled,
    transcriptLookbackDays: config.transcriptLookbackDays,
    maxReindexRecords: config.maxReindexRecords,
    maxExportRecords: config.maxExportRecords,
    maxImportRecords: config.maxImportRecords,
    cipRequireSanitization: config.cipRequireSanitization,
    cipDedupeAcrossUsers: config.cipDedupeAcrossUsers,
    cipAllowCrossUserLocalImport: config.cipAllowCrossUserLocalImport,
  };
}

/** @deprecated Use readCursorIndexConfig */
export async function readReindexConfig(env) {
  return readCursorIndexConfig(env);
}

/** @deprecated Use writeCursorIndexConfig */
export async function writeReindexConfig(env, patch) {
  return writeCursorIndexConfig(env, {
    indexEnabled: patch.reindexEnabled,
    indexWritePolicy: patch.reindexWritePolicy,
    updatedBy: patch.updatedBy,
  });
}

/** @deprecated */
export function buildPublicReindexPolicy(config) {
  return buildPublicCursorIndexPolicy(config);
}

/** @deprecated */
export const DEFAULT_REINDEX_CONFIG = DEFAULT_CURSOR_INDEX_CONFIG;
