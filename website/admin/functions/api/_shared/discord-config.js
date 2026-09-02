import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:discord";

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

const DISCORD_INVITE_RE =
  /^https:\/\/(?:discord\.gg\/[\w-]+|discord\.com\/invite\/[\w-]+)$/i;

/** Canonical Lorapok Labs Family invite — matches @lorapok/cursor-monitor-shared. */
export const DEFAULT_COMMUNITY_INVITE_URL = "https://discord.gg/bp42QAMC6";

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
 * @param {string} url
 */
export function isValidDiscordInviteUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    return DISCORD_INVITE_RE.test(new URL(url.trim()).href);
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
 * Normalizes stored Discord webhook configuration values.
 * @param {Object} parsed - Stored configuration data, including optional webhook URLs and update metadata.
 * @returns {{deploymentWebhookUrl: string, feedbackWebhookUrl: string, updatedAt: unknown, updatedBy: unknown}} The normalized configuration, using the legacy `webhookUrl` as a deployment webhook fallback.
 */
function normalizeStoredConfig(parsed) {
  const deploymentWebhookUrl = String(
    parsed.deploymentWebhookUrl ?? parsed.webhookUrl ?? ""
  );
  const feedbackWebhookUrl = String(parsed.feedbackWebhookUrl ?? "");
  const communityWebhookUrl = String(parsed.communityWebhookUrl ?? "");
  const communityInviteUrl = String(
    parsed.communityInviteUrl ?? DEFAULT_COMMUNITY_INVITE_URL
  ).trim();
  return {
    deploymentWebhookUrl,
    feedbackWebhookUrl,
    communityWebhookUrl,
    communityInviteUrl: isValidDiscordInviteUrl(communityInviteUrl)
      ? communityInviteUrl
      : DEFAULT_COMMUNITY_INVITE_URL,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
  };
}

/**
 * Reads the Discord configuration from KV storage.
 * Returns an empty configuration when storage is unavailable, empty, malformed, or unreadable.
 * @return {{deploymentWebhookUrl: string, feedbackWebhookUrl: string, updatedAt: unknown, updatedBy: unknown}} The normalized Discord configuration.
 */
export async function readDiscordConfig(env) {
  const empty = {
    deploymentWebhookUrl: "",
    feedbackWebhookUrl: "",
    communityWebhookUrl: "",
    communityInviteUrl: DEFAULT_COMMUNITY_INVITE_URL,
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
 * Stores the Discord configuration in administrative key-value storage.
 * @param {Record<string, unknown>} env - The environment containing the administrative KV binding.
 * @param {{ deploymentWebhookUrl?: string; feedbackWebhookUrl?: string; communityWebhookUrl?: string; updatedAt: string; updatedBy: string }} config - The configuration to store.
 * @throws {Error} If the administrative KV binding is unavailable.
 */
export async function writeDiscordConfig(env, config) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await putKvJsonIfChanged(env, CONFIG_KEY, config);
}

/**
 * Creates a client-safe summary of the configured Discord webhooks.
 * @param {{ deploymentWebhookUrl?: string; feedbackWebhookUrl?: string; communityWebhookUrl?: string; webhookUrl?: string; updatedAt?: string | null; updatedBy?: string | null }} config - The stored Discord configuration.
 * @return {{ deploymentConfigured: boolean; feedbackConfigured: boolean; communityConfigured: boolean; deploymentWebhookPreview: string | null; feedbackWebhookPreview: string | null; communityWebhookPreview: string | null; configured: boolean; webhookPreview: string | null; updatedAt: string | null; updatedBy: string | null }} Configuration status, masked webhook previews, and update metadata.
 */
export function sanitizeDiscordConfigForClient(config) {
  const deploymentWebhookUrl = String(
    config.deploymentWebhookUrl ?? config.webhookUrl ?? ""
  );
  const feedbackWebhookUrl = String(config.feedbackWebhookUrl ?? "");
  const communityWebhookUrl = String(config.communityWebhookUrl ?? "");
  const communityInviteUrl = String(config.communityInviteUrl ?? DEFAULT_COMMUNITY_INVITE_URL);
  const deploymentConfigured = Boolean(
    deploymentWebhookUrl && isValidDiscordWebhookUrl(deploymentWebhookUrl)
  );
  const feedbackConfigured = Boolean(
    feedbackWebhookUrl && isValidDiscordWebhookUrl(feedbackWebhookUrl)
  );
  const communityConfigured = Boolean(
    communityWebhookUrl && isValidDiscordWebhookUrl(communityWebhookUrl)
  );
  return {
    deploymentConfigured,
    feedbackConfigured,
    communityConfigured,
    deploymentWebhookPreview: deploymentWebhookUrl ? maskWebhookUrl(deploymentWebhookUrl) : null,
    feedbackWebhookPreview: feedbackWebhookUrl ? maskWebhookUrl(feedbackWebhookUrl) : null,
    communityWebhookPreview: communityWebhookUrl ? maskWebhookUrl(communityWebhookUrl) : null,
    communityInviteUrl,
    communityInviteConfigured: isValidDiscordInviteUrl(communityInviteUrl),
    /** @deprecated use deploymentConfigured */
    configured: deploymentConfigured,
    /** @deprecated use deploymentWebhookPreview */
    webhookPreview: deploymentWebhookUrl ? maskWebhookUrl(deploymentWebhookUrl) : null,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}
