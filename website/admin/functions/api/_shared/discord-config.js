const CONFIG_KEY = "integrations:discord";

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

/**
 * Determines whether a value is a valid Discord webhook URL.
 * @param {string} url - The value to validate.
 * @return {boolean} `true` if the value is a valid Discord webhook URL, `false` otherwise.
 */
export function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    return DISCORD_WEBHOOK_RE.test(new URL(url.trim()).href);
  } catch {
    return false;
  }
}

/**
 * Creates a privacy-safe preview of a Discord webhook URL.
 * @param {string} url - The Discord webhook URL to mask.
 * @return {string|null} The webhook ID and final four token characters, `configured` for unrecognized non-empty values, or `null` for empty input.
 */
export function maskWebhookUrl(url) {
  if (!url) return null;
  const match = String(url).match(/\/webhooks\/(\d+)\/([\w-]+)$/);
  if (!match) return "configured";
  const [, id, token] = match;
  return `${id} ···${token.slice(-4)}`;
}

function normalizeStoredConfig(parsed) {
  const deploymentWebhookUrl = String(
    parsed.deploymentWebhookUrl ?? parsed.webhookUrl ?? ""
  );
  const feedbackWebhookUrl = String(parsed.feedbackWebhookUrl ?? "");
  return {
    deploymentWebhookUrl,
    feedbackWebhookUrl,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
  };
}

/**
 * Read the Discord configuration from KV storage.
 * @returns {Promise<{deploymentWebhookUrl: string, feedbackWebhookUrl: string, updatedAt: unknown, updatedBy: unknown}>}
 */
export async function readDiscordConfig(env) {
  const empty = {
    deploymentWebhookUrl: "",
    feedbackWebhookUrl: "",
    updatedAt: null,
    updatedBy: null,
  };
  if (!env?.ADMIN_KV?.get) return empty;
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return empty;
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return empty;
  }
}

/**
 * Store the Discord configuration in administrative key-value storage.
 * @param {Record<string, unknown>} env - The environment containing the administrative KV binding.
 * @param {{ deploymentWebhookUrl?: string; feedbackWebhookUrl?: string; updatedAt: string; updatedBy: string }} config
 */
export async function writeDiscordConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await env.ADMIN_KV.put(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Creates a client-safe Discord configuration summary.
 * @param {{ deploymentWebhookUrl?: string; feedbackWebhookUrl?: string; webhookUrl?: string; updatedAt?: string | null; updatedBy?: string | null }} config
 */
export function sanitizeDiscordConfigForClient(config) {
  const deploymentWebhookUrl = String(
    config.deploymentWebhookUrl ?? config.webhookUrl ?? ""
  );
  const feedbackWebhookUrl = String(config.feedbackWebhookUrl ?? "");
  const deploymentConfigured = Boolean(
    deploymentWebhookUrl && isValidDiscordWebhookUrl(deploymentWebhookUrl)
  );
  const feedbackConfigured = Boolean(
    feedbackWebhookUrl && isValidDiscordWebhookUrl(feedbackWebhookUrl)
  );
  return {
    deploymentConfigured,
    feedbackConfigured,
    deploymentWebhookPreview: deploymentWebhookUrl ? maskWebhookUrl(deploymentWebhookUrl) : null,
    feedbackWebhookPreview: feedbackWebhookUrl ? maskWebhookUrl(feedbackWebhookUrl) : null,
    /** @deprecated use deploymentConfigured */
    configured: deploymentConfigured,
    /** @deprecated use deploymentWebhookPreview */
    webhookPreview: deploymentWebhookUrl ? maskWebhookUrl(deploymentWebhookUrl) : null,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}
