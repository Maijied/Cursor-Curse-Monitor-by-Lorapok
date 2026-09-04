import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { formatKvPutError } from "../../_shared/kv-put.js";
import {
  firebaseConfigToGithubSecrets,
  isCompleteFirebaseConfig,
  normalizeFirebaseConfig,
  readFirebaseConfig,
  sanitizeFirebaseConfigForClient,
  writeFirebaseConfig,
} from "../../_shared/firebase-config.js";
import { readGithubIntegrationConfig } from "../../_shared/github-integration-config.js";
import { setGithubEnvironmentSecrets } from "../../_shared/github-secrets.js";

/**
 * Retrieves Firebase web client settings for an authenticated administrator.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;

  const config = await readFirebaseConfig(env);
  return jsonResponse({ ok: true, config: sanitizeFirebaseConfigForClient(config) });
}

/**
 * Saves Firebase web client settings and syncs VITE_FIREBASE_* to GitHub environment secrets.
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

  const current = (await readFirebaseConfig(env)) ?? normalizeFirebaseConfig({});
  const next = normalizeFirebaseConfig({
    ...current,
    apiKey: body.apiKey !== undefined ? String(body.apiKey ?? "").trim() : current.apiKey,
    authDomain: body.authDomain !== undefined ? String(body.authDomain ?? "").trim() : current.authDomain,
    projectId: body.projectId !== undefined ? String(body.projectId ?? "").trim() : current.projectId,
    storageBucket:
      body.storageBucket !== undefined ? String(body.storageBucket ?? "").trim() : current.storageBucket,
    messagingSenderId:
      body.messagingSenderId !== undefined
        ? String(body.messagingSenderId ?? "").trim()
        : current.messagingSenderId,
    appId: body.appId !== undefined ? String(body.appId ?? "").trim() : current.appId,
    measurementId:
      body.measurementId !== undefined ? String(body.measurementId ?? "").trim() : current.measurementId,
    updatedAt: new Date().toISOString(),
    updatedBy: auth.email,
  });

  if (!isCompleteFirebaseConfig(next)) {
    return jsonResponse(
      { error: "apiKey, authDomain, projectId, storageBucket, messagingSenderId, and appId are required" },
      400
    );
  }

  let githubSecretsSyncedAt = next.githubSecretsSyncedAt ?? null;
  let githubSyncWarning = null;
  if (body.syncGithubSecrets !== false && env.GITHUB_TOKEN) {
    try {
      const ghConfig = await readGithubIntegrationConfig(env);
      await setGithubEnvironmentSecrets(env, firebaseConfigToGithubSecrets(next), {
        repo: ghConfig.repository,
        environment: ghConfig.secretsEnvironment,
      });
      githubSecretsSyncedAt = new Date().toISOString();
    } catch (err) {
      githubSyncWarning = err instanceof Error ? err.message : "GitHub secret sync failed";
    }
  } else if (body.syncGithubSecrets !== false && !env.GITHUB_TOKEN) {
    githubSyncWarning = "GITHUB_TOKEN not configured — saved to KV only";
  }

  const persisted = { ...next, githubSecretsSyncedAt };

  try {
    await writeFirebaseConfig(env, persisted);
  } catch (err) {
    return jsonResponse({ error: formatKvPutError(err) }, 503);
  }

  return jsonResponse({
    ok: true,
    config: sanitizeFirebaseConfigForClient(persisted),
    githubSecretsSyncedAt,
    githubSyncWarning,
  });
}
