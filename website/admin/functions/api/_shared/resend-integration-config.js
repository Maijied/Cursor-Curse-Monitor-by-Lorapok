import { putKvJsonIfChanged } from "./kv-put.js";
import { readMailConfig, normalizeMailConfig } from "./mail-config.js";

const CONFIG_KEY = "integrations:resend";

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeResendIntegrationConfig(parsed) {
  return {
    resendFromOverride: String(parsed.resendFromOverride ?? "").trim(),
    resendDomainVerified: parsed.resendDomainVerified === true,
    resendFirstExternal: parsed.resendFirstExternal !== false,
    workersFreeMode: parsed.workersFreeMode !== false,
    sendingDomain: String(parsed.sendingDomain ?? "lorapok.tech").trim().toLowerCase(),
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
    githubSecretsSyncedAt: parsed.githubSecretsSyncedAt ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readResendIntegrationConfig(env) {
  const mail = await readMailConfig(env);
  let kvMeta = null;
  if (env?.ADMIN_KV?.get) {
    try {
      const raw = await env.ADMIN_KV.get(CONFIG_KEY);
      if (raw) kvMeta = normalizeResendIntegrationConfig(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }
  return normalizeResendIntegrationConfig({
    resendFromOverride: mail.resendFromOverride,
    resendDomainVerified: mail.resendDomainVerified,
    resendFirstExternal: mail.resendFirstExternal,
    workersFreeMode: mail.workersFreeMode,
    sendingDomain: mail.sendingDomain,
    ...(kvMeta ?? {}),
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof normalizeResendIntegrationConfig>} config
 */
export async function writeResendIntegrationMeta(env, config) {
  if (!env?.ADMIN_KV?.put) return;
  await putKvJsonIfChanged(env.ADMIN_KV, CONFIG_KEY, normalizeResendIntegrationConfig(config));
}

/**
 * @param {Record<string, string | undefined>} secrets
 */
export function resendSecretsToGithubMap(secrets) {
  const out = {};
  if (secrets.resendApiKey) out.RESEND_API_KEY = secrets.resendApiKey;
  if (secrets.resendFrom) out.RESEND_FROM = secrets.resendFrom;
  return out;
}

/**
 * @param {ReturnType<typeof normalizeResendIntegrationConfig>} config
 * @param {Record<string, unknown>} env
 * @param {string[]} [secretNames]
 */
export function sanitizeResendIntegrationForClient(config, env, secretNames = []) {
  const resendFromEnv = String(env?.RESEND_FROM ?? "").trim();
  const resendFromOverride = String(config.resendFromOverride ?? "").trim();
  return {
    sendingDomain: config.sendingDomain,
    resendFromOverride,
    resendFromEffective: resendFromEnv || resendFromOverride || null,
    resendDomainVerified: config.resendDomainVerified,
    resendFirstExternal: config.resendFirstExternal,
    workersFreeMode: config.workersFreeMode,
    resendApiKeyConfigured: Boolean(String(env?.RESEND_API_KEY ?? "").trim()),
    resendFromConfigured: Boolean(resendFromEnv),
    secretsPresent: secretNames,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    githubSecretsSyncedAt: config.githubSecretsSyncedAt,
  };
}
