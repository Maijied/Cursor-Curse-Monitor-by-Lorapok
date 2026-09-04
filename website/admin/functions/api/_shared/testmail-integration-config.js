import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:testmail";

export const DEFAULT_TESTMAIL_INTEGRATION = {
  namespace: "",
  probeEnabled: true,
};

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeTestmailIntegrationConfig(parsed) {
  return {
    namespace: String(parsed.namespace ?? DEFAULT_TESTMAIL_INTEGRATION.namespace).trim(),
    probeEnabled: parsed.probeEnabled !== false,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
    githubSecretsSyncedAt: parsed.githubSecretsSyncedAt ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readTestmailIntegrationConfig(env) {
  const fromEnv = normalizeTestmailIntegrationConfig({
    namespace: env.TESTMAIL_NAMESPACE,
  });
  if (!env?.ADMIN_KV?.get) return fromEnv;
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return fromEnv;
    const kv = normalizeTestmailIntegrationConfig(JSON.parse(raw));
    return {
      ...fromEnv,
      ...kv,
      namespace: kv.namespace || fromEnv.namespace,
    };
  } catch {
    return fromEnv;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof normalizeTestmailIntegrationConfig>} config
 */
export async function writeTestmailIntegrationConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await putKvJsonIfChanged(env.ADMIN_KV, CONFIG_KEY, normalizeTestmailIntegrationConfig(config));
}

/**
 * @param {Record<string, string | undefined>} secrets
 */
export function testmailSecretsToGithubMap(secrets) {
  const out = {};
  if (secrets.testmailApiKey) out.TESTMAIL_API_KEY = secrets.testmailApiKey;
  if (secrets.testmailNamespace) out.TESTMAIL_NAMESPACE = secrets.testmailNamespace;
  return out;
}

/**
 * @param {ReturnType<typeof normalizeTestmailIntegrationConfig>} config
 * @param {Record<string, unknown>} env
 * @param {string[]} [secretNames]
 */
export function sanitizeTestmailIntegrationForClient(config, env, secretNames = []) {
  const namespace = config.namespace || String(env?.TESTMAIL_NAMESPACE ?? "").trim();
  return {
    namespace,
    namespacePreview: namespace ? `···${namespace.slice(-6)}` : null,
    probeEnabled: config.probeEnabled,
    testmailApiKeyConfigured: Boolean(String(env?.TESTMAIL_API_KEY ?? "").trim()),
    testmailNamespaceConfigured: Boolean(namespace),
    secretsPresent: secretNames,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
    githubSecretsSyncedAt: config.githubSecretsSyncedAt,
  };
}
