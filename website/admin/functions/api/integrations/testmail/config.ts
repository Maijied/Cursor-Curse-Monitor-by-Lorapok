import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import { readGithubIntegrationConfig } from "../../_shared/github-integration-config.js";
import { listGithubEnvironmentSecretNames, setGithubEnvironmentSecrets } from "../../_shared/github-secrets.js";
import {
  readTestmailIntegrationConfig,
  sanitizeTestmailIntegrationForClient,
  testmailSecretsToGithubMap,
  writeTestmailIntegrationConfig,
} from "../../_shared/testmail-integration-config.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readTestmailIntegrationConfig(env);
  const ghConfig = await readGithubIntegrationConfig(env);
  let secretNames: string[] = [];
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
    config: sanitizeTestmailIntegrationForClient(config, env, secretNames),
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const current = await readTestmailIntegrationConfig(env);
  const next = {
    ...current,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.email,
  };

  if (body.namespace !== undefined) {
    next.namespace = String(body.namespace ?? "").trim();
  }
  if (body.probeEnabled !== undefined) {
    if (typeof body.probeEnabled !== "boolean") {
      return jsonResponse({ error: "probeEnabled must be a boolean" }, 400);
    }
    next.probeEnabled = body.probeEnabled;
  }

  const secretPayload = testmailSecretsToGithubMap({
    testmailApiKey: body.testmailApiKey !== undefined ? String(body.testmailApiKey ?? "").trim() : undefined,
    testmailNamespace:
      body.testmailApiKey !== undefined && body.namespace !== undefined
        ? String(body.namespace ?? "").trim()
        : body.testmailNamespace !== undefined
          ? String(body.testmailNamespace ?? "").trim()
          : undefined,
  });

  if (body.namespace !== undefined && !body.testmailApiKey && secretPayload.TESTMAIL_NAMESPACE === undefined) {
    secretPayload.TESTMAIL_NAMESPACE = next.namespace;
  }

  let githubSecretsSyncedAt = current.githubSecretsSyncedAt ?? null;
  let githubSyncWarning: string | null = null;

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

  const hasMeta =
    body.namespace !== undefined ||
    body.probeEnabled !== undefined ||
    Object.keys(secretPayload).length > 0;
  if (!hasMeta) {
    return jsonResponse({ error: "At least one testmail setting or secret is required" }, 400);
  }

  next.githubSecretsSyncedAt = githubSecretsSyncedAt;

  try {
    await writeTestmailIntegrationConfig(env, next);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  const ghConfig = await readGithubIntegrationConfig(env);
  let secretNames: string[] = [];
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
    config: sanitizeTestmailIntegrationForClient(next, env, secretNames),
    githubSecretsSyncedAt,
    githubSyncWarning,
  });
}
