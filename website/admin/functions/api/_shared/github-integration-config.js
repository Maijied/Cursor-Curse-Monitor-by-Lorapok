import { putKvJsonIfChanged } from "./kv-put.js";
import { DEFAULT_GITHUB_SECRETS_ENV } from "./github-secrets.js";
import { GITHUB_REPO } from "./repo-constants.js";

const CONFIG_KEY = "integrations:github";

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeGithubIntegrationConfig(parsed) {
  const repository = String(parsed.repository ?? GITHUB_REPO).trim() || GITHUB_REPO;
  const secretsEnvironment = String(parsed.secretsEnvironment ?? DEFAULT_GITHUB_SECRETS_ENV).trim() ||
    DEFAULT_GITHUB_SECRETS_ENV;
  return {
    repository,
    secretsEnvironment,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
    githubSecretsSyncedAt: parsed.githubSecretsSyncedAt ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
async function readGithubIntegrationFromKv(env) {
  if (!env?.ADMIN_KV?.get) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const raw = await env.ADMIN_KV.get(CONFIG_KEY);
  if (!raw) return normalizeGithubIntegrationConfig({});
  return normalizeGithubIntegrationConfig(JSON.parse(raw));
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readGithubIntegrationConfig(env) {
  if (!env?.ADMIN_KV?.get) {
    return normalizeGithubIntegrationConfig({});
  }
  try {
    return await readGithubIntegrationFromKv(env);
  } catch {
    return normalizeGithubIntegrationConfig({});
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof normalizeGithubIntegrationConfig>} config
 */
export async function writeGithubIntegrationConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await putKvJsonIfChanged(env.ADMIN_KV, CONFIG_KEY, normalizeGithubIntegrationConfig(config));
}

/**
 * @param {ReturnType<typeof normalizeGithubIntegrationConfig>} config
 * @param {Record<string, unknown>} env
 * @param {string[]} [secretNames]
 */
export function sanitizeGithubIntegrationForClient(config, env, secretNames = []) {
  return {
    repository: config.repository,
    secretsEnvironment: config.secretsEnvironment,
    tokenConfigured: Boolean(env.GITHUB_TOKEN),
    secretsPresent: secretNames,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    githubSecretsSyncedAt: config.githubSecretsSyncedAt,
  };
}
