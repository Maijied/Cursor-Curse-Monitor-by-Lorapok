import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import { GITHUB_REPO } from "../../_shared/repo-constants.js";
import {
  normalizeGithubIntegrationConfig,
  readGithubIntegrationConfig,
  sanitizeGithubIntegrationForClient,
  writeGithubIntegrationConfig,
} from "../../_shared/github-integration-config.js";
import {
  listGithubEnvironmentSecretNames,
  setGithubEnvironmentSecret,
} from "../../_shared/github-secrets.js";

/**
 * Retrieves GitHub integration metadata and secret presence for administrators.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readGithubIntegrationConfig(env);
  let secretNames = [];
  if (env.GITHUB_TOKEN) {
    try {
      secretNames = await listGithubEnvironmentSecretNames(env, {
        repo: config.repository,
        environment: config.secretsEnvironment,
      });
    } catch {
      secretNames = [];
    }
  }

  return jsonResponse({
    ok: true,
    config: sanitizeGithubIntegrationForClient(config, env, secretNames),
  });
}

/**
 * Updates GitHub repository metadata and optionally rotates GITHUB_TOKEN into environment secrets.
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const current = await readGithubIntegrationConfig(env);
  const repository = body.repository !== undefined ? String(body.repository ?? "").trim() : current.repository;
  const secretsEnvironment =
    body.secretsEnvironment !== undefined
      ? String(body.secretsEnvironment ?? "").trim()
      : current.secretsEnvironment;

  if (!repository.includes("/")) {
    return jsonResponse({ error: "repository must be owner/name" }, 400);
  }
  if (!secretsEnvironment) {
    return jsonResponse({ error: "secretsEnvironment is required" }, 400);
  }

  const githubToken = body.githubToken !== undefined ? String(body.githubToken ?? "").trim() : "";
  let githubSecretsSyncedAt = current.githubSecretsSyncedAt ?? null;
  let githubSyncWarning = null;

  if (githubToken) {
    if (!env.GITHUB_TOKEN) {
      githubSyncWarning = "GITHUB_TOKEN not configured on Mission Control — cannot rotate GitHub PAT secret";
    } else {
    try {
      await setGithubEnvironmentSecret(env, "GITHUB_TOKEN", githubToken, {
        repo: repository,
        environment: secretsEnvironment,
      });
      githubSecretsSyncedAt = new Date().toISOString();
    } catch (err) {
      githubSyncWarning = err instanceof Error ? err.message : "GitHub token secret sync failed";
    }
    }
  }

  const next = normalizeGithubIntegrationConfig({
    repository: repository || GITHUB_REPO,
    secretsEnvironment,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.email,
    githubSecretsSyncedAt,
  });

  try {
    await writeGithubIntegrationConfig(env, next);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  let secretNames = [];
  if (env.GITHUB_TOKEN) {
    try {
      secretNames = await listGithubEnvironmentSecretNames(env, {
        repo: next.repository,
        environment: next.secretsEnvironment,
      });
    } catch {
      secretNames = [];
    }
  }

  return jsonResponse({
    ok: true,
    config: sanitizeGithubIntegrationForClient(next, env, secretNames),
    githubSecretsSyncedAt,
    githubSyncWarning,
  });
}
