const CONFIG_KEY = "integrations:discord";

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

/** @param {string} url */
export function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    return DISCORD_WEBHOOK_RE.test(new URL(url.trim()).href);
  } catch {
    return false;
  }
}

/** @param {string} url */
export function maskWebhookUrl(url) {
  if (!url) return null;
  const match = String(url).match(/\/webhooks\/(\d+)\/([\w-]+)$/);
  if (!match) return "configured";
  const [, id, token] = match;
  return `${id} ···${token.slice(-4)}`;
}

/**
 * @param {Record<string, unknown>} env
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
 * @param {Record<string, unknown>} env
 * @param {{ webhookUrl: string; updatedAt: string; updatedBy: string }} config
 */
export async function writeDiscordConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await env.ADMIN_KV.put(CONFIG_KEY, JSON.stringify(config));
}

/**
 * @param {{ webhookUrl: string; updatedAt?: string | null; updatedBy?: string | null }} config
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
