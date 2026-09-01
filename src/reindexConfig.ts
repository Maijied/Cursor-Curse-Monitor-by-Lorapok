import * as vscode from "vscode";

export type ReindexWritePolicy = "live" | "quit-first";

export type ReindexPolicy = {
  reindexEnabled: boolean;
  reindexWritePolicy: ReindexWritePolicy;
  requireEditorQuit: boolean;
};

const DEFAULT_SITE_CONFIG_URL = "https://cursor-dev.lorapok.tech/api/site-config";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPolicy: ReindexPolicy | null = null;
let cachedAtMs = 0;

function siteConfigUrl(): string {
  return (
    vscode.workspace.getConfiguration("cursorCurseMonitor").get<string>("siteConfigUrl")?.trim() ||
    DEFAULT_SITE_CONFIG_URL
  );
}

function defaultPolicy(): ReindexPolicy {
  return {
    reindexEnabled: true,
    reindexWritePolicy: "live",
    requireEditorQuit: false,
  };
}

function normalizePolicy(raw: Record<string, unknown> | null | undefined): ReindexPolicy {
  if (!raw) return defaultPolicy();
  const writePolicy = raw.reindexWritePolicy === "quit-first" ? "quit-first" : "live";
  const requireEditorQuit =
    typeof raw.requireEditorQuit === "boolean"
      ? raw.requireEditorQuit
      : writePolicy === "quit-first";
  return {
    reindexEnabled: raw.reindexEnabled !== false,
    reindexWritePolicy: writePolicy,
    requireEditorQuit,
  };
}

function readLocalOverride(): Partial<ReindexPolicy> {
  const config = vscode.workspace.getConfiguration("cursorCurseMonitor");
  const override: Partial<ReindexPolicy> = {};

  const policy = config.get<ReindexWritePolicy | "default">("reindexWritePolicy");
  if (policy === "live" || policy === "quit-first") {
    override.reindexWritePolicy = policy;
    override.requireEditorQuit = policy === "quit-first";
  }

  return override;
}

function readEnvOverride(): Partial<ReindexPolicy> {
  const override: Partial<ReindexPolicy> = {};
  if (process.env.CCM_REINDEX_ENABLED === "0") override.reindexEnabled = false;
  if (process.env.CCM_REINDEX_ENABLED === "1") override.reindexEnabled = true;
  if (process.env.CCM_REINDEX_REQUIRE_EDITOR_QUIT === "1") {
    override.reindexWritePolicy = "quit-first";
    override.requireEditorQuit = true;
  }
  if (process.env.CCM_REINDEX_REQUIRE_EDITOR_QUIT === "0") {
    override.reindexWritePolicy = "live";
    override.requireEditorQuit = false;
  }
  return override;
}

function mergePolicy(base: ReindexPolicy, patch: Partial<ReindexPolicy>): ReindexPolicy {
  const next = { ...base, ...patch };
  if (patch.reindexWritePolicy && patch.requireEditorQuit === undefined) {
    next.requireEditorQuit = patch.reindexWritePolicy === "quit-first";
  }
  return next;
}

async function fetchRemotePolicy(): Promise<ReindexPolicy> {
  try {
    const response = await fetch(siteConfigUrl(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return defaultPolicy();
    const data = (await response.json()) as Record<string, unknown>;
    return normalizePolicy(data);
  } catch {
    return defaultPolicy();
  }
}

/** Resolve reindex policy from Mission Control site-config with local overrides. */
export async function resolveReindexPolicy(forceRefresh = false): Promise<ReindexPolicy> {
  const now = Date.now();
  if (!forceRefresh && cachedPolicy && now - cachedAtMs < CACHE_TTL_MS) {
    return mergePolicy(cachedPolicy, { ...readEnvOverride(), ...readLocalOverride() });
  }

  const remote = await fetchRemotePolicy();
  cachedPolicy = remote;
  cachedAtMs = now;
  return mergePolicy(remote, { ...readEnvOverride(), ...readLocalOverride() });
}

export function clearReindexPolicyCache(): void {
  cachedPolicy = null;
  cachedAtMs = 0;
}
