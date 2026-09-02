import { putKvJsonIfChanged } from "./kv-put.js";
import { getMailTransportStatus } from "./mail.js";
import { buildPublicCursorIndexPolicy, readCursorIndexConfig } from "./cursor-index-config.js";
import { DEFAULT_COMMUNITY_INVITE_URL, readDiscordConfig } from "./discord-config.js";

const CONFIG_KEY = "integrations:subscribe-prompt";

const DISCORD_INVITE_RE =
  /^https:\/\/(?:discord\.gg\/[\w-]+|discord\.com\/invite\/[\w-]+)$/i;

/** @typedef {"discord" | "hidden"} SubscribeFallbackMode */

export const DEFAULT_SUBSCRIBE_CONFIG = {
  subscribeModalEnabled: true,
  requireMailForSubscribe: true,
  subscribeFallbackDiscordUrl: DEFAULT_COMMUNITY_INVITE_URL,
  subscribeFallbackMode: /** @type {SubscribeFallbackMode} */ ("discord"),
};

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
 * @param {Record<string, unknown>} parsed
 */
export function normalizeSubscribeConfig(parsed) {
  const fallbackMode =
    parsed.subscribeFallbackMode === "hidden" ? "hidden" : "discord";
  const fallbackUrl = String(
    parsed.subscribeFallbackDiscordUrl ?? DEFAULT_SUBSCRIBE_CONFIG.subscribeFallbackDiscordUrl
  ).trim();

  return {
    subscribeModalEnabled: parsed.subscribeModalEnabled !== false,
    requireMailForSubscribe: parsed.requireMailForSubscribe !== false,
    subscribeFallbackDiscordUrl: isValidDiscordInviteUrl(fallbackUrl)
      ? fallbackUrl
      : DEFAULT_SUBSCRIBE_CONFIG.subscribeFallbackDiscordUrl,
    subscribeFallbackMode: fallbackMode,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readSubscribeConfig(env) {
  if (!env?.ADMIN_KV?.get) return { ...DEFAULT_SUBSCRIBE_CONFIG, subscribeFallbackDiscordUrlExplicit: false };
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_SUBSCRIBE_CONFIG, subscribeFallbackDiscordUrlExplicit: false };
    const parsed = JSON.parse(raw);
    return {
      ...normalizeSubscribeConfig(parsed),
      subscribeFallbackDiscordUrlExplicit: Object.prototype.hasOwnProperty.call(
        parsed,
        "subscribeFallbackDiscordUrl"
      ),
    };
  } catch {
    return { ...DEFAULT_SUBSCRIBE_CONFIG, subscribeFallbackDiscordUrlExplicit: false };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} patch
 */
export async function writeSubscribeConfig(env, patch) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const current = await readSubscribeConfig(env);
  const next = normalizeSubscribeConfig({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy ?? current.updatedBy ?? null,
  });
  await putKvJsonIfChanged(env, CONFIG_KEY, next);
  return next;
}

/**
 * @param {ReturnType<typeof normalizeSubscribeConfig>} config
 */
export function sanitizeSubscribeConfigForClient(config) {
  return {
    subscribeModalEnabled: config.subscribeModalEnabled,
    requireMailForSubscribe: config.requireMailForSubscribe,
    subscribeFallbackDiscordUrl: config.subscribeFallbackDiscordUrl,
    subscribeFallbackMode: config.subscribeFallbackMode,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

/**
 * Public, secret-free subscribe availability for the marketing site.
 * @param {Record<string, unknown>} env
 */
export async function buildPublicSiteConfig(env) {
  const mail = getMailTransportStatus(env);
  const config = await readSubscribeConfig(env);
  const discord = await readDiscordConfig(env);
  const indexConfig = await readCursorIndexConfig(env);
  const mailConfigured = mail.configured;
  const subscribeAvailable =
    config.subscribeModalEnabled &&
    (!config.requireMailForSubscribe || mailConfigured);

  const showDiscordFallback =
    !subscribeAvailable && config.subscribeFallbackMode === "discord";

  const communityInviteUrl = discord.communityInviteUrl || DEFAULT_COMMUNITY_INVITE_URL;
  const fallbackInvite = config.subscribeFallbackDiscordUrlExplicit
    ? config.subscribeFallbackDiscordUrl || communityInviteUrl
    : communityInviteUrl;

  return {
    mailConfigured,
    subscribeAvailable,
    subscribeModalEnabled: config.subscribeModalEnabled,
    requireMailForSubscribe: config.requireMailForSubscribe,
    subscribeFallbackMode: showDiscordFallback ? "discord" : config.subscribeFallbackMode,
    subscribeFallbackDiscordUrl: showDiscordFallback ? fallbackInvite : null,
    discordInviteUrl: communityInviteUrl,
    mailTransport: mail.configured ? mail.transport : "none",
    ...buildPublicCursorIndexPolicy(indexConfig),
  };
}
