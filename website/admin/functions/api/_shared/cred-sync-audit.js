import { putKvJsonIfChanged } from "./kv-put.js";
import { logSystemEvent } from "./system-log.js";
import { listGithubEnvironmentSecretNames, setGithubEnvironmentSecrets } from "./github-secrets.js";
import { readGithubIntegrationConfig } from "./github-integration-config.js";

export const CRED_SYNC_AUDIT_KEY = "integrations:cred-sync";
export const CRED_SYNC_LOG_SOURCE = "cred-sync";

/** CI decrypt secrets that must exist in admin-production for cred vault deploy. */
export const REQUIRED_CI_SECRET_NAMES = ["CRED_STORE_GPG_BASE64", "CRED_VAULT_PASSPHRASE"];

const MAX_RECENT_ATTEMPTS = 20;
const RETRY_DELAY_MS = 400;

/**
 * @param {unknown} parsed
 */
export function normalizeCredSyncState(parsed) {
  const base = parsed && typeof parsed === "object" ? parsed : {};
  const recentAttempts = Array.isArray(base.recentAttempts) ? base.recentAttempts.slice(0, MAX_RECENT_ATTEMPTS) : [];
  return {
    lastAttemptAt: base.lastAttemptAt ?? null,
    lastSuccessAt: base.lastSuccessAt ?? null,
    lastFailureAt: base.lastFailureAt ?? null,
    lastError: base.lastError ?? null,
    lastIntegration: base.lastIntegration ?? null,
    lastActor: base.lastActor ?? null,
    lastSecretNames: Array.isArray(base.lastSecretNames) ? base.lastSecretNames : [],
    recentAttempts,
  };
}

/**
 * @param {string[]} expectedNames
 * @param {string[]} presentNames
 */
export function computeSecretDrift(expectedNames, presentNames) {
  const present = new Set(presentNames);
  const missing = expectedNames.filter((name) => !present.has(name));
  return { missing, ok: missing.length === 0 };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readCredSyncState(env) {
  if (!env?.ADMIN_KV?.get) return normalizeCredSyncState(null);
  try {
    const raw = await env.ADMIN_KV.get(CRED_SYNC_AUDIT_KEY);
    if (!raw) return normalizeCredSyncState(null);
    return normalizeCredSyncState(JSON.parse(raw));
  } catch {
    return normalizeCredSyncState(null);
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof normalizeCredSyncState>} state
 */
export async function writeCredSyncState(env, state) {
  if (!env?.ADMIN_KV?.put) return;
  await putKvJsonIfChanged(env.ADMIN_KV, CRED_SYNC_AUDIT_KEY, normalizeCredSyncState(state));
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ integration: string; actor?: string | null; ok: boolean; secretNames?: string[]; error?: string | null; retryCount?: number }} entry
 */
export async function recordCredSyncAttempt(env, entry) {
  const ts = new Date().toISOString();
  const secretNames = Array.isArray(entry.secretNames) ? entry.secretNames : [];
  const attempt = {
    ts,
    integration: entry.integration,
    actor: entry.actor ?? null,
    ok: entry.ok === true,
    secretNames,
    error: entry.error ?? null,
    retryCount: entry.retryCount ?? 0,
  };

  const current = await readCredSyncState(env);
  const next = normalizeCredSyncState({
    ...current,
    lastAttemptAt: ts,
    lastIntegration: entry.integration,
    lastActor: entry.actor ?? null,
    lastSecretNames: secretNames,
    lastSuccessAt: entry.ok ? ts : current.lastSuccessAt,
    lastFailureAt: entry.ok ? current.lastFailureAt : ts,
    lastError: entry.ok ? null : entry.error ?? "GitHub secret sync failed",
    recentAttempts: [attempt, ...current.recentAttempts].slice(0, MAX_RECENT_ATTEMPTS),
  });

  try {
    await writeCredSyncState(env, next);
  } catch {
    /* non-fatal */
  }

  try {
    await logSystemEvent(env, {
      source: CRED_SYNC_LOG_SOURCE,
      level: entry.ok ? "info" : "warn",
      message: entry.ok
        ? `Cred sync OK (${entry.integration}): ${secretNames.join(", ") || "no secrets"}`
        : `Cred sync failed (${entry.integration}): ${entry.error ?? "unknown error"}`,
      email: entry.actor ?? undefined,
      meta: {
        event: entry.ok ? "cred-sync.ok" : "cred-sync.fail",
        integration: entry.integration,
        secretNames,
        retryCount: entry.retryCount ?? 0,
        error: entry.error ?? null,
      },
    });
  } catch {
    /* non-fatal */
  }

  return next;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string[]} expectedNames
 * @param {{ repo?: string; environment?: string }} [options]
 */
export async function detectGithubSecretDrift(env, expectedNames, options = {}) {
  if (!env.GITHUB_TOKEN || !expectedNames.length) {
    return { missing: expectedNames, ok: expectedNames.length === 0, presentNames: [] };
  }
  let presentNames = [];
  try {
    presentNames = await listGithubEnvironmentSecretNames(env, options);
  } catch {
    return { missing: expectedNames, ok: false, presentNames: [] };
  }
  return { ...computeSecretDrift(expectedNames, presentNames), presentNames };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sync GitHub environment secrets with one automatic retry and audit logging.
 *
 * @param {Record<string, unknown>} env
 * @param {Record<string, string>} secrets
 * @param {{ integration: string; actor?: string | null; repo?: string; environment?: string; skipAudit?: boolean }} options
 */
export async function syncGithubSecretsWithAudit(env, secrets, options) {
  const entries = Object.entries(secrets).filter(([, value]) => value != null && String(value).length > 0);
  const secretNames = entries.map(([name]) => name);

  if (!entries.length) {
    return { syncedNames: [], syncedAt: null, warning: null, ok: true, retryCount: 0 };
  }

  if (!env.GITHUB_TOKEN) {
    const warning = "GITHUB_TOKEN not configured — metadata saved to KV only";
    if (!options.skipAudit) {
      await recordCredSyncAttempt(env, {
        integration: options.integration,
        actor: options.actor,
        ok: false,
        secretNames,
        error: warning,
        retryCount: 0,
      });
    }
    return { syncedNames: [], syncedAt: null, warning, ok: false, retryCount: 0 };
  }

  const ghConfig = await readGithubIntegrationConfig(env);
  const repo = options.repo ?? ghConfig.repository;
  const environment = options.environment ?? ghConfig.secretsEnvironment;
  const payload = Object.fromEntries(entries);

  let lastError = null;
  let retryCount = 0;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const syncedNames = await setGithubEnvironmentSecrets(env, payload, { repo, environment });
      const syncedAt = new Date().toISOString();
      if (!options.skipAudit) {
        await recordCredSyncAttempt(env, {
          integration: options.integration,
          actor: options.actor,
          ok: true,
          secretNames: syncedNames,
          retryCount,
        });
      }
      return { syncedNames, syncedAt, warning: null, ok: true, retryCount };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "GitHub secret sync failed";
      if (attempt === 0) {
        retryCount = 1;
        await sleep(RETRY_DELAY_MS);
        continue;
      }
    }
  }

  if (!options.skipAudit) {
    await recordCredSyncAttempt(env, {
      integration: options.integration,
      actor: options.actor,
      ok: false,
      secretNames,
      error: lastError,
      retryCount,
    });
  }

  return {
    syncedNames: [],
    syncedAt: null,
    warning: lastError,
    ok: false,
    retryCount,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ secretNames?: string[] }} [options]
 */
export async function buildCredSyncHealth(env, options = {}) {
  const state = await readCredSyncState(env);
  const ghConfig = await readGithubIntegrationConfig(env);
  const expectedNames = options.secretNames?.length
    ? options.secretNames
    : [...REQUIRED_CI_SECRET_NAMES];

  let presentNames = [];
  let drift = { missing: expectedNames, ok: false };
  if (env.GITHUB_TOKEN) {
    try {
      presentNames = await listGithubEnvironmentSecretNames(env, {
        repo: ghConfig.repository,
        environment: ghConfig.secretsEnvironment,
      });
      drift = computeSecretDrift(expectedNames, presentNames);
    } catch {
      drift = { missing: expectedNames, ok: false };
    }
  }

  const ciSecretsReady =
    REQUIRED_CI_SECRET_NAMES.every((name) => presentNames.includes(name));
  const lastSyncOk = state.lastFailureAt
    ? state.lastSuccessAt && state.lastSuccessAt > state.lastFailureAt
    : Boolean(state.lastSuccessAt);
  const recentFailure =
    state.lastFailureAt &&
    (!state.lastSuccessAt || state.lastFailureAt >= state.lastSuccessAt);

  return {
    configured: Boolean(env.GITHUB_TOKEN),
    ciSecretsReady,
    credVaultCiConfigured: ciSecretsReady,
    lastSyncAt: state.lastSuccessAt ?? state.lastAttemptAt,
    lastSyncOk: !recentFailure && Boolean(state.lastSuccessAt),
    lastError: recentFailure ? state.lastError : null,
    lastIntegration: state.lastIntegration,
    driftMissing: drift.missing,
    neverMiss: Boolean(env.GITHUB_TOKEN) && ciSecretsReady && !recentFailure && drift.ok,
    recentAttempts: state.recentAttempts.slice(0, 5),
  };
}
