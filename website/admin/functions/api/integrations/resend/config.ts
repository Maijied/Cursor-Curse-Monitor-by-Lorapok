import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import { isValidSendingDomain, writeMailConfig } from "../../_shared/mail-config.js";
import { readGithubIntegrationConfig } from "../../_shared/github-integration-config.js";
import { listGithubEnvironmentSecretNames, setGithubEnvironmentSecrets } from "../../_shared/github-secrets.js";
import {
  readResendIntegrationConfig,
  resendSecretsToGithubMap,
  sanitizeResendIntegrationForClient,
  writeResendIntegrationMeta,
} from "../../_shared/resend-integration-config.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readResendIntegrationConfig(env);
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
    config: sanitizeResendIntegrationForClient(config, env, secretNames),
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

  const current = await readResendIntegrationConfig(env);
  const patch: Record<string, unknown> = { updatedBy: auth.email };

  if (body.sendingDomain !== undefined) {
    const domain = String(body.sendingDomain ?? "").trim().toLowerCase();
    if (!isValidSendingDomain(domain)) {
      return jsonResponse({ error: "Invalid sending domain" }, 400);
    }
    patch.sendingDomain = domain;
  }
  if (body.resendFromOverride !== undefined) {
    patch.resendFromOverride = String(body.resendFromOverride ?? "").trim();
  }
  if (body.resendDomainVerified !== undefined) {
    if (typeof body.resendDomainVerified !== "boolean") {
      return jsonResponse({ error: "resendDomainVerified must be a boolean" }, 400);
    }
    patch.resendDomainVerified = body.resendDomainVerified;
  }
  if (body.resendFirstExternal !== undefined) {
    if (typeof body.resendFirstExternal !== "boolean") {
      return jsonResponse({ error: "resendFirstExternal must be a boolean" }, 400);
    }
    patch.resendFirstExternal = body.resendFirstExternal;
  }
  if (body.workersFreeMode !== undefined) {
    if (typeof body.workersFreeMode !== "boolean") {
      return jsonResponse({ error: "workersFreeMode must be a boolean" }, 400);
    }
    patch.workersFreeMode = body.workersFreeMode;
  }
  if (body.monthlyEmailLimit !== undefined) {
    const n = Number(body.monthlyEmailLimit);
    if (!Number.isFinite(n) || n < 1 || n > 100000) {
      return jsonResponse({ error: "monthlyEmailLimit must be between 1 and 100000" }, 400);
    }
    patch.monthlyEmailLimit = Math.round(n);
  }
  if (body.dailyEmailLimit !== undefined) {
    const n = Number(body.dailyEmailLimit);
    if (!Number.isFinite(n) || n < 1 || n > 10000) {
      return jsonResponse({ error: "dailyEmailLimit must be between 1 and 10000" }, 400);
    }
    patch.dailyEmailLimit = Math.round(n);
  }

  const secretPayload = resendSecretsToGithubMap({
    resendApiKey: body.resendApiKey !== undefined ? String(body.resendApiKey ?? "").trim() : undefined,
    resendFrom: body.resendFrom !== undefined ? String(body.resendFrom ?? "").trim() : undefined,
  });

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

  const hasMetaPatch = Object.keys(patch).some((k) => k !== "updatedBy");
  if (!hasMetaPatch && Object.keys(secretPayload).length === 0) {
    return jsonResponse({ error: "At least one Resend setting or secret is required" }, 400);
  }

  let persisted = { ...current, ...patch, githubSecretsSyncedAt, updatedAt: new Date().toISOString() };

  try {
    if (hasMetaPatch) {
      await writeMailConfig(env, {
        sendingDomain: persisted.sendingDomain,
        resendFromOverride: persisted.resendFromOverride,
        resendDomainVerified: persisted.resendDomainVerified,
        resendFirstExternal: persisted.resendFirstExternal,
        workersFreeMode: persisted.workersFreeMode,
        updatedBy: auth.email,
      });
      await writeResendIntegrationMeta(env, persisted);
    }
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
    config: sanitizeResendIntegrationForClient(persisted, env, secretNames),
    githubSecretsSyncedAt,
    githubSyncWarning,
  });
}
