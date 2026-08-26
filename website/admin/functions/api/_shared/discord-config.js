const CONFIG_KEY = "integrations:discord";

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

export const DEFAULT_DISCORD_CONFIG = {
  enabled: false,
  webhookUrl: "",
  events: {
    started: true,
    completed: true,
    failed: true,
    pushed: true,
  },
  updatedAt: null,
  updatedBy: null,
};

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
 * @returns {Promise<typeof DEFAULT_DISCORD_CONFIG>}
 */
export async function readDiscordConfig(env) {
  if (!env?.ADMIN_KV?.get) return { ...DEFAULT_DISCORD_CONFIG };
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_DISCORD_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DISCORD_CONFIG,
      ...parsed,
      events: { ...DEFAULT_DISCORD_CONFIG.events, ...(parsed.events ?? {}) },
    };
  } catch {
    return { ...DEFAULT_DISCORD_CONFIG };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {typeof DEFAULT_DISCORD_CONFIG} config
 */
export async function writeDiscordConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await env.ADMIN_KV.put(CONFIG_KEY, JSON.stringify(config));
}

/**
 * @param {typeof DEFAULT_DISCORD_CONFIG} config
 */
export function sanitizeDiscordConfigForClient(config) {
  const { webhookUrl, ...rest } = config;
  return {
    ...rest,
    configured: Boolean(webhookUrl && isValidDiscordWebhookUrl(webhookUrl)),
    webhookPreview: webhookUrl ? maskWebhookUrl(webhookUrl) : null,
  };
}
