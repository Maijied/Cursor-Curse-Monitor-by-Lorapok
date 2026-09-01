import * as vscode from "vscode";

export type CursorIndexWritePolicy = "live" | "quit-first";

export type CursorIndexPolicy = {
  indexEnabled: boolean;
  indexWritePolicy: CursorIndexWritePolicy;
  requireEditorQuit: boolean;
  cipExportEnabled: boolean;
  cipImportEnabled: boolean;
  transcriptLookbackDays: number;
  maxReindexRecords: number;
  maxExportRecords: number;
  maxImportRecords: number;
  cipRequireSanitization: boolean;
  cipDedupeAcrossUsers: boolean;
  cipAllowCrossUserLocalImport: boolean;
  /** Back-compat aliases used by older call sites. */
  reindexEnabled: boolean;
  reindexWritePolicy: CursorIndexWritePolicy;
  cipEnabled: boolean;
};

const DEFAULT_SITE_CONFIG_URL = "https://cursor-dev.lorapok.tech/api/site-config";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPolicy: CursorIndexPolicy | null = null;
let cachedAtMs = 0;

function siteConfigUrl(): string {
  return (
    vscode.workspace.getConfiguration("cursorCurseMonitor").get<string>("siteConfigUrl")?.trim() ||
    DEFAULT_SITE_CONFIG_URL
  );
}

function defaultPolicy(): CursorIndexPolicy {
  return normalizePolicy({});
}

function clampInt(value: unknown, fallback: number, max = 100000): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(0, Math.trunc(num)));
}

export function normalizePolicy(raw: Record<string, unknown> | null | undefined): CursorIndexPolicy {
  const writePolicy =
    raw?.indexWritePolicy === "quit-first" || raw?.reindexWritePolicy === "quit-first"
      ? "quit-first"
      : "live";
  const indexEnabled =
    raw?.indexEnabled !== false && raw?.reindexEnabled !== false && raw?.cipEnabled !== false;
  const cipExportEnabled = indexEnabled && raw?.cipExportEnabled !== false;
  const cipImportEnabled = indexEnabled && raw?.cipImportEnabled !== false;
  const requireEditorQuit =
    typeof raw?.requireEditorQuit === "boolean"
      ? raw.requireEditorQuit
      : writePolicy === "quit-first";

  return {
    indexEnabled,
    indexWritePolicy: writePolicy,
    requireEditorQuit,
    cipExportEnabled,
    cipImportEnabled,
    transcriptLookbackDays: clampInt(raw?.transcriptLookbackDays, 0, 3650),
    maxReindexRecords: clampInt(raw?.maxReindexRecords, 5000),
    maxExportRecords: clampInt(raw?.maxExportRecords, 5000),
    maxImportRecords: clampInt(raw?.maxImportRecords, 5000),
    cipRequireSanitization: raw?.cipRequireSanitization !== false,
    cipDedupeAcrossUsers: raw?.cipDedupeAcrossUsers === true,
    cipAllowCrossUserLocalImport: raw?.cipAllowCrossUserLocalImport === true,
    reindexEnabled: indexEnabled,
    reindexWritePolicy: writePolicy,
    cipEnabled: indexEnabled && (cipExportEnabled || cipImportEnabled),
  };
}

export function transcriptCutoffMs(policy: CursorIndexPolicy, nowMs = Date.now()): number | null {
  if (policy.transcriptLookbackDays <= 0) return null;
  return nowMs - policy.transcriptLookbackDays * 24 * 60 * 60 * 1000;
}

export function lookbackLabel(policy: CursorIndexPolicy): string {
  if (policy.transcriptLookbackDays <= 0) return "all available transcripts";
  if (policy.transcriptLookbackDays === 1) return "the last 1 day";
  return `the last ${policy.transcriptLookbackDays} days`;
}

function readLocalOverride(): Partial<CursorIndexPolicy> {
  const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
  const override: Partial<CursorIndexPolicy> = {};
  const policy =
    config.get<CursorIndexWritePolicy | "default">("indexWritePolicy") ??
    config.get<CursorIndexWritePolicy | "default">("reindexWritePolicy");
  if (policy === "live" || policy === "quit-first") {
    override.indexWritePolicy = policy;
    override.reindexWritePolicy = policy;
    override.requireEditorQuit = policy === "quit-first";
  }
  return override;
}

function readEnvOverride(): Partial<CursorIndexPolicy> {
  const override: Partial<CursorIndexPolicy> = {};
  if (process.env.CCM_INDEX_ENABLED === "0" || process.env.CCM_REINDEX_ENABLED === "0") {
    override.indexEnabled = false;
    override.reindexEnabled = false;
  }
  if (process.env.CCM_INDEX_ENABLED === "1" || process.env.CCM_REINDEX_ENABLED === "1") {
    override.indexEnabled = true;
    override.reindexEnabled = true;
  }
  if (process.env.CCM_INDEX_REQUIRE_EDITOR_QUIT === "1" || process.env.CCM_REINDEX_REQUIRE_EDITOR_QUIT === "1") {
    override.indexWritePolicy = "quit-first";
    override.reindexWritePolicy = "quit-first";
    override.requireEditorQuit = true;
  }
  if (process.env.CCM_INDEX_REQUIRE_EDITOR_QUIT === "0" || process.env.CCM_REINDEX_REQUIRE_EDITOR_QUIT === "0") {
    override.indexWritePolicy = "live";
    override.reindexWritePolicy = "live";
    override.requireEditorQuit = false;
  }
  if (process.env.CCM_TRANSCRIPT_LOOKBACK_DAYS) {
    override.transcriptLookbackDays = clampInt(process.env.CCM_TRANSCRIPT_LOOKBACK_DAYS, 0, 3650);
  }
  if (process.env.CCM_MAX_REINDEX_RECORDS) {
    override.maxReindexRecords = clampInt(process.env.CCM_MAX_REINDEX_RECORDS, 5000);
  }
  return override;
}

function mergePolicy(base: CursorIndexPolicy, patch: Partial<CursorIndexPolicy>): CursorIndexPolicy {
  const next = normalizePolicy({ ...base, ...patch });
  return next;
}

async function fetchRemotePolicy(): Promise<CursorIndexPolicy> {
  try {
    const response = await fetch(siteConfigUrl(), { headers: { Accept: "application/json" } });
    if (!response.ok) return defaultPolicy();
    const data = (await response.json()) as Record<string, unknown>;
    return normalizePolicy(data);
  } catch {
    return defaultPolicy();
  }
}

/** Resolve unified cursor index policy from Mission Control site-config. */
export async function resolveCursorIndexPolicy(forceRefresh = false): Promise<CursorIndexPolicy> {
  const now = Date.now();
  if (!forceRefresh && cachedPolicy && now - cachedAtMs < CACHE_TTL_MS) {
    return mergePolicy(cachedPolicy, { ...readEnvOverride(), ...readLocalOverride() });
  }
  const remote = await fetchRemotePolicy();
  cachedPolicy = remote;
  cachedAtMs = now;
  return mergePolicy(remote, { ...readEnvOverride(), ...readLocalOverride() });
}

export function clearCursorIndexPolicyCache(): void {
  cachedPolicy = null;
  cachedAtMs = 0;
}

/** @deprecated Use resolveCursorIndexPolicy */
export type ReindexPolicy = Pick<
  CursorIndexPolicy,
  "reindexEnabled" | "reindexWritePolicy" | "requireEditorQuit"
> &
  CursorIndexPolicy;

/** @deprecated Use resolveCursorIndexPolicy */
export async function resolveReindexPolicy(forceRefresh = false): Promise<ReindexPolicy> {
  return resolveCursorIndexPolicy(forceRefresh);
}

/** @deprecated */
export function clearReindexPolicyCache(): void {
  clearCursorIndexPolicyCache();
}

export type ReindexWritePolicy = CursorIndexWritePolicy;
