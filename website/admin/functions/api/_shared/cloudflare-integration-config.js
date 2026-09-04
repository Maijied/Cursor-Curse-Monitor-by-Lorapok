import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:cloudflare";

export const DEFAULT_CLOUDFLARE_INTEGRATION = {
  accountId: "f049faaf2f67549f5c58837479596a4a",
  pagesProjectName: "cursor-monitor-admin",
  adminPublicUrl: "https://cursor-dev.lorapok.tech",
  siteDataUrl: "https://cursor.lorapok.tech/site-data.json",
};

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeCloudflareIntegrationConfig(parsed) {
  return {
    accountId: String(parsed.accountId ?? DEFAULT_CLOUDFLARE_INTEGRATION.accountId).trim(),
    pagesProjectName: String(parsed.pagesProjectName ?? DEFAULT_CLOUDFLARE_INTEGRATION.pagesProjectName).trim(),
    adminPublicUrl: String(parsed.adminPublicUrl ?? DEFAULT_CLOUDFLARE_INTEGRATION.adminPublicUrl).trim(),
    siteDataUrl: String(parsed.siteDataUrl ?? DEFAULT_CLOUDFLARE_INTEGRATION.siteDataUrl).trim(),
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
    githubSecretsSyncedAt: parsed.githubSecretsSyncedAt ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export function resolveCloudflareIntegrationFromEnv(env) {
  return normalizeCloudflareIntegrationConfig({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    pagesProjectName: env.CLOUDFLARE_PAGES_PROJECT ?? "cursor-monitor-admin",
    adminPublicUrl: env.ADMIN_PUBLIC_URL,
    siteDataUrl: env.SITE_DATA_URL,
  });
}

/**
 * @param {Record<string, unknown>} env
 */
async function readCloudflareIntegrationFromKv(env) {
  if (!env?.ADMIN_KV?.get) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const raw = await env.ADMIN_KV.get(CONFIG_KEY);
  if (!raw) return null;
  return normalizeCloudflareIntegrationConfig(JSON.parse(raw));
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readCloudflareIntegrationConfig(env) {
  try {
    const fromKv = await readCloudflareIntegrationFromKv(env);
    if (fromKv) return fromKv;
  } catch {
    /* fall through */
  }
  return { ...resolveCloudflareIntegrationFromEnv(env), updatedAt: null, updatedBy: null };
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof normalizeCloudflareIntegrationConfig>} config
 */
export async function writeCloudflareIntegrationConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await putKvJsonIfChanged(env.ADMIN_KV, CONFIG_KEY, normalizeCloudflareIntegrationConfig(config));
}

/**
 * @param {ReturnType<typeof normalizeCloudflareIntegrationConfig>} config
 * @param {Record<string, unknown>} env
 * @param {string[]} [secretNames]
 */
export function sanitizeCloudflareIntegrationForClient(config, env, secretNames = []) {
  const accountId = config.accountId || env.CLOUDFLARE_ACCOUNT_ID || "";
  return {
    accountId,
    accountIdPreview: accountId ? `···${accountId.slice(-4)}` : null,
    pagesProjectName: config.pagesProjectName,
    adminPublicUrl: config.adminPublicUrl,
    siteDataUrl: config.siteDataUrl,
    apiTokenConfigured: Boolean(env.CLOUDFLARE_API_TOKEN),
    emailApiTokenConfigured: Boolean(env.CLOUDFLARE_EMAIL_API_TOKEN),
    cronSecretConfigured: Boolean(env.CRON_SECRET),
    resendApiKeyConfigured: Boolean(env.RESEND_API_KEY),
    secretsPresent: secretNames,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    githubSecretsSyncedAt: config.githubSecretsSyncedAt,
  };
}

/**
 * @param {Record<string, string | undefined>} secrets
 */
export function cloudflareSecretsToGithubMap(secrets) {
  const out = {};
  if (secrets.apiToken) out.CLOUDFLARE_API_TOKEN = secrets.apiToken;
  if (secrets.emailApiToken) out.CLOUDFLARE_EMAIL_API_TOKEN = secrets.emailApiToken;
  if (secrets.accountId) out.CLOUDFLARE_ACCOUNT_ID = secrets.accountId;
  if (secrets.cronSecret) out.CRON_SECRET = secrets.cronSecret;
  if (secrets.resendApiKey) out.RESEND_API_KEY = secrets.resendApiKey;
  return out;
}
