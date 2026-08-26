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

/**
 * Read the Discord configuration from KV storage.
 * @returns {Promise<{webhookUrl: string, updatedAt: unknown, updatedBy: unknown}>} The normalized Discord configuration, or empty defaults when unavailable or invalid.
 */
export async function readDiscordConfig(env) {
  if (!env?.ADMIN_KV?.get) return { webhookUrl: "", updatedAt: null, updatedBy: null };
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return { webhookUrl: "", updatedAt: null, updatedBy: null };
    const parsed = JSON.parse(raw);
    return {
      webhookUrl: String(parsed.webhookUrl ?? ""),
      updatedAt: parsed.updatedAt ?? null,
      updatedBy: parsed.updatedBy ?? null,
    };
  } catch {
    return { webhookUrl: "", updatedAt: null, updatedBy: null };
  }
}

/**
 * Store the Discord configuration in administrative key-value storage.
 * @param {Record<string, unknown>} env - The environment containing the administrative KV binding.
 * @param {{ webhookUrl: string; updatedAt: string; updatedBy: string }} config - The Discord configuration to store.
 */
export async function writeDiscordConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await env.ADMIN_KV.put(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Creates a client-safe Discord configuration summary.
 * @param {{ webhookUrl: string; updatedAt?: string | null; updatedBy?: string | null }} config - The Discord webhook configuration and update metadata.
 * @return {{ configured: boolean; webhookPreview: string | null; updatedAt: string | null; updatedBy: string | null }} The configuration status, masked webhook preview, and normalized update metadata.
 */
export function sanitizeDiscordConfigForClient(config) {
  const { webhookUrl, updatedAt, updatedBy } = config;
  return {
    configured: Boolean(webhookUrl && isValidDiscordWebhookUrl(webhookUrl)),
    webhookPreview: webhookUrl ? maskWebhookUrl(webhookUrl) : null,
    updatedAt: updatedAt ?? null,
    updatedBy: updatedBy ?? null,
  };
}
