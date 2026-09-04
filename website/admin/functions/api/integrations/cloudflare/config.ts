import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  cloudflareSecretsToGithubMap,
  normalizeCloudflareIntegrationConfig,
  readCloudflareIntegrationConfig,
  sanitizeCloudflareIntegrationForClient,
  writeCloudflareIntegrationConfig,
} from "../../_shared/cloudflare-integration-config.js";
import { readGithubIntegrationConfig } from "../../_shared/github-integration-config.js";
import { listGithubEnvironmentSecretNames, setGithubEnvironmentSecrets } from "../../_shared/github-secrets.js";

/**
 * Retrieves Cloudflare integration metadata for administrators.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const config = await readCloudflareIntegrationConfig(env);
  const ghConfig = await readGithubIntegrationConfig(env);
  let secretNames = [];
  if (env.GITHUB_TOKEN) {
    try {
      secretNames = await listGithubEnvironmentSecretNames(env, {
        repo: ghConfig.repository,
        environment: ghConfig.secretsEnvironment,
      });
    } catch {
      secretNames = [];
    }
  }

  return jsonResponse({
    ok: true,
    config: sanitizeCloudflareIntegrationForClient(config, env, secretNames),
  });
}

/**
 * Updates Cloudflare URLs/metadata and optionally syncs tokens to GitHub environment secrets.
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const current = await readCloudflareIntegrationConfig(env);
  const next = normalizeCloudflareIntegrationConfig({
    ...current,
    accountId: body.accountId !== undefined ? String(body.accountId ?? "").trim() : current.accountId,
    pagesProjectName:
      body.pagesProjectName !== undefined ? String(body.pagesProjectName ?? "").trim() : current.pagesProjectName,
    adminPublicUrl:
      body.adminPublicUrl !== undefined ? String(body.adminPublicUrl ?? "").trim() : current.adminPublicUrl,
    siteDataUrl: body.siteDataUrl !== undefined ? String(body.siteDataUrl ?? "").trim() : current.siteDataUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.email,
  });

  if (!next.accountId || !next.pagesProjectName) {
    return jsonResponse({ error: "accountId and pagesProjectName are required" }, 400);
  }

  let githubSecretsSyncedAt = current.githubSecretsSyncedAt ?? null;
  let githubSyncWarning = null;
  const secretPayload = cloudflareSecretsToGithubMap({
    apiToken: body.apiToken !== undefined ? String(body.apiToken ?? "").trim() : undefined,
    globalApiKey: body.globalApiKey !== undefined ? String(body.globalApiKey ?? "").trim() : undefined,
    accountEmail: body.accountEmail !== undefined ? String(body.accountEmail ?? "").trim() : undefined,
    emailApiToken: body.emailApiToken !== undefined ? String(body.emailApiToken ?? "").trim() : undefined,
    accountId: next.accountId,
    cronSecret: body.cronSecret !== undefined ? String(body.cronSecret ?? "").trim() : undefined,
    resendApiKey: body.resendApiKey !== undefined ? String(body.resendApiKey ?? "").trim() : undefined,
  });

  if (body.syncGithubSecrets !== false && Object.keys(secretPayload).length > 0 && env.GITHUB_TOKEN) {
    try {
      const ghConfig = await readGithubIntegrationConfig(env);
      await setGithubEnvironmentSecrets(env, secretPayload, {
        repo: ghConfig.repository,
        environment: ghConfig.secretsEnvironment,
      });
      githubSecretsSyncedAt = new Date().toISOString();
    } catch (err) {
      githubSyncWarning = err instanceof Error ? err.message : "GitHub secret sync failed";
    }
  } else if (body.syncGithubSecrets !== false && Object.keys(secretPayload).length > 0 && !env.GITHUB_TOKEN) {
    githubSyncWarning = "GITHUB_TOKEN not configured — metadata saved to KV only";
  }

  const persisted = { ...next, githubSecretsSyncedAt };

  try {
    await writeCloudflareIntegrationConfig(env, persisted);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  const ghConfig = await readGithubIntegrationConfig(env);
  let secretNames = [];
  if (env.GITHUB_TOKEN) {
    try {
      secretNames = await listGithubEnvironmentSecretNames(env, {
        repo: ghConfig.repository,
        environment: ghConfig.secretsEnvironment,
      });
    } catch {
      secretNames = [];
    }
  }

  return jsonResponse({
    ok: true,
    config: sanitizeCloudflareIntegrationForClient(persisted, env, secretNames),
    githubSecretsSyncedAt,
    githubSyncWarning,
  });
}
