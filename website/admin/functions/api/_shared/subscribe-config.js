import { putKvJsonIfChanged } from "./kv-put.js";
import { getMailTransportStatus } from "./mail.js";
import { buildPublicReindexPolicy, readReindexConfig } from "./reindex-config.js";

const CONFIG_KEY = "integrations:subscribe-prompt";

const DISCORD_INVITE_RE =
  /^https:\/\/(?:discord\.gg\/[\w-]+|discord\.com\/invite\/[\w-]+)$/i;

/** @typedef {"discord" | "hidden"} SubscribeFallbackMode */

export const DEFAULT_SUBSCRIBE_CONFIG = {
  subscribeModalEnabled: true,
  requireMailForSubscribe: true,
  subscribeFallbackDiscordUrl: "https://discord.gg/MaYRtaqef",
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
  if (!env?.ADMIN_KV?.get) return { ...DEFAULT_SUBSCRIBE_CONFIG };
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_SUBSCRIBE_CONFIG };
    return normalizeSubscribeConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SUBSCRIBE_CONFIG };
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
  const reindexConfig = await readReindexConfig(env);
  const mailConfigured = mail.configured;
  const subscribeAvailable =
    config.subscribeModalEnabled &&
    (!config.requireMailForSubscribe || mailConfigured);

  const showDiscordFallback =
    !subscribeAvailable && config.subscribeFallbackMode === "discord";

  return {
    mailConfigured,
    subscribeAvailable,
    subscribeModalEnabled: config.subscribeModalEnabled,
    requireMailForSubscribe: config.requireMailForSubscribe,
    subscribeFallbackMode: showDiscordFallback ? "discord" : config.subscribeFallbackMode,
    subscribeFallbackDiscordUrl: showDiscordFallback
      ? config.subscribeFallbackDiscordUrl
      : null,
    mailTransport: mail.configured ? mail.transport : "none",
    ...buildPublicReindexPolicy(reindexConfig),
  };
}
