import { putKvJsonIfChanged } from "./kv-put.js";

export const SOCIAL_CONFIG_KEY = "integrations:social";

/** Platforms configured under Settings → Social (Discord stays on its own tab). */
export const SOCIAL_PLATFORMS = ["telegram", "mastodon", "bluesky", "x", "linkedin"];

const MASTODON_INSTANCE_RE = /^https:\/\/[\w.-]+\/?$/i;

function emptyPlatformConfig() {
  return {
    telegram: { enabled: false, botToken: "", chatId: "" },
    mastodon: { enabled: false, instanceUrl: "", accessToken: "" },
    bluesky: { enabled: false, handle: "", appPassword: "" },
    x: { enabled: false, bearerToken: "" },
    linkedin: { enabled: false, accessToken: "", authorUrn: "" },
    updatedAt: null,
    updatedBy: null,
  };
}

/**
 * @param {string | null | undefined} value
 */
export function maskSocialSecret(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (text.length <= 4) return "configured";
  return `···${text.slice(-4)}`;
}

/**
 * @param {string} platform
 * @param {Record<string, unknown>} data
 */
export function validateSocialPlatform(platform, data) {
  const enabled = Boolean(data.enabled);
  if (!enabled) return { ok: true, enabled: false };

  switch (platform) {
    case "telegram": {
      const botToken = String(data.botToken ?? "").trim();
      const chatId = String(data.chatId ?? "").trim();
      if (!botToken || !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
        return { ok: false, error: "Invalid Telegram bot token" };
      }
      if (!chatId) return { ok: false, error: "Telegram chat ID is required" };
      return { ok: true, enabled: true };
    }
    case "mastodon": {
      const instanceUrl = String(data.instanceUrl ?? "").trim().replace(/\/+$/, "");
      const accessToken = String(data.accessToken ?? "").trim();
      if (!instanceUrl || !MASTODON_INSTANCE_RE.test(`${instanceUrl}/`)) {
        return { ok: false, error: "Invalid Mastodon instance URL" };
      }
      if (!accessToken) return { ok: false, error: "Mastodon access token is required" };
      return { ok: true, enabled: true };
    }
    case "bluesky": {
      const handle = String(data.handle ?? "").trim().replace(/^@/, "");
      const appPassword = String(data.appPassword ?? "").trim();
      if (!handle || !handle.includes(".")) {
        return { ok: false, error: "Invalid Bluesky handle" };
      }
      if (!appPassword) return { ok: false, error: "Bluesky app password is required" };
      return { ok: true, enabled: true };
    }
    case "x": {
      const bearerToken = String(data.bearerToken ?? "").trim();
      if (!bearerToken) return { ok: false, error: "X bearer token is required" };
      return { ok: true, enabled: true };
    }
    case "linkedin": {
      const accessToken = String(data.accessToken ?? "").trim();
      const authorUrn = String(data.authorUrn ?? "").trim();
      if (!accessToken) return { ok: false, error: "LinkedIn access token is required" };
      if (!authorUrn.startsWith("urn:li:")) {
        return { ok: false, error: "LinkedIn author URN must start with urn:li:" };
      }
      return { ok: true, enabled: true };
    }
    default:
      return { ok: false, error: "Unknown platform" };
  }
}

/**
 * @param {Record<string, unknown>} parsed
 */
function normalizeStoredConfig(parsed) {
  const base = emptyPlatformConfig();
  for (const platform of SOCIAL_PLATFORMS) {
    const stored = parsed?.[platform];
    if (!stored || typeof stored !== "object") continue;
    base[platform] = {
      ...base[platform],
      enabled: Boolean(stored.enabled),
      ...(platform === "telegram"
        ? {
            botToken: String(stored.botToken ?? ""),
            chatId: String(stored.chatId ?? ""),
          }
        : platform === "mastodon"
          ? {
              instanceUrl: String(stored.instanceUrl ?? "").replace(/\/+$/, ""),
              accessToken: String(stored.accessToken ?? ""),
            }
          : platform === "bluesky"
            ? {
                handle: String(stored.handle ?? "").replace(/^@/, ""),
                appPassword: String(stored.appPassword ?? ""),
              }
            : platform === "x"
              ? { bearerToken: String(stored.bearerToken ?? "") }
              : {
                  accessToken: String(stored.accessToken ?? ""),
                  authorUrn: String(stored.authorUrn ?? ""),
                }),
    };
  }
  base.updatedAt = parsed?.updatedAt ?? null;
  base.updatedBy = parsed?.updatedBy ?? null;
  return base;
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readSocialConfig(env) {
  if (!env?.ADMIN_KV?.get) return emptyPlatformConfig();
  try {
    const raw = await env.ADMIN_KV.get(SOCIAL_CONFIG_KEY);
    if (!raw) return emptyPlatformConfig();
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return emptyPlatformConfig();
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} config
 */
export async function writeSocialConfig(env, config) {
  if (!env?.ADMIN_KV?.put) throw new Error("ADMIN_KV binding not configured");
  await putKvJsonIfChanged(env, SOCIAL_CONFIG_KEY, config);
}

/**
 * @param {Record<string, unknown>} config
 */
export function sanitizeSocialPlatformForClient(platform, config) {
  const data = config?.[platform] ?? {};
  const validation = validateSocialPlatform(platform, data);
  const common = {
    enabled: Boolean(data.enabled),
    configured: validation.ok && validation.enabled === true,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };

  switch (platform) {
    case "telegram":
      return {
        ...common,
        chatId: data.chatId ? String(data.chatId) : "",
        botTokenPreview: data.botToken ? maskSocialSecret(data.botToken) : null,
      };
    case "mastodon":
      return {
        ...common,
        instanceUrl: data.instanceUrl ? String(data.instanceUrl) : "",
        accessTokenPreview: data.accessToken ? maskSocialSecret(data.accessToken) : null,
      };
    case "bluesky":
      return {
        ...common,
        handle: data.handle ? String(data.handle) : "",
        appPasswordPreview: data.appPassword ? maskSocialSecret(data.appPassword) : null,
      };
    case "x":
      return {
        ...common,
        bearerTokenPreview: data.bearerToken ? maskSocialSecret(data.bearerToken) : null,
      };
    case "linkedin":
      return {
        ...common,
        authorUrn: data.authorUrn ? String(data.authorUrn) : "",
        accessTokenPreview: data.accessToken ? maskSocialSecret(data.accessToken) : null,
      };
    default:
      return common;
  }
}

/**
 * @param {Record<string, unknown>} config
 */
export function sanitizeSocialConfigForClient(config) {
  /** @type {Record<string, unknown>} */
  const platforms = {};
  for (const platform of SOCIAL_PLATFORMS) {
    platforms[platform] = sanitizeSocialPlatformForClient(platform, config);
  }
  const enabledCount = SOCIAL_PLATFORMS.filter(
    (platform) => platforms[platform].configured
  ).length;
  return {
    platforms,
    enabledCount,
    configured: enabledCount > 0,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} current
 * @param {string} platform
 * @param {Record<string, unknown>} body
 */
export function mergeSocialPlatformUpdate(current, platform, body) {
  if (!SOCIAL_PLATFORMS.includes(platform)) {
    throw new Error("Unknown platform");
  }
  const prev = current[platform] ?? {};
  const next = { ...prev };

  if (body.enabled !== undefined) next.enabled = Boolean(body.enabled);

  if (platform === "telegram") {
    if (body.botToken !== undefined && String(body.botToken).trim()) {
      next.botToken = String(body.botToken).trim();
    }
    if (body.chatId !== undefined) next.chatId = String(body.chatId ?? "").trim();
  } else if (platform === "mastodon") {
    if (body.instanceUrl !== undefined) {
      next.instanceUrl = String(body.instanceUrl ?? "").trim().replace(/\/+$/, "");
    }
    if (body.accessToken !== undefined && String(body.accessToken).trim()) {
      next.accessToken = String(body.accessToken).trim();
    }
  } else if (platform === "bluesky") {
    if (body.handle !== undefined) {
      next.handle = String(body.handle ?? "").trim().replace(/^@/, "");
    }
    if (body.appPassword !== undefined && String(body.appPassword).trim()) {
      next.appPassword = String(body.appPassword).trim();
    }
  } else if (platform === "x") {
    if (body.bearerToken !== undefined && String(body.bearerToken).trim()) {
      next.bearerToken = String(body.bearerToken).trim();
    }
  } else if (platform === "linkedin") {
    if (body.accessToken !== undefined && String(body.accessToken).trim()) {
      next.accessToken = String(body.accessToken).trim();
    }
    if (body.authorUrn !== undefined) next.authorUrn = String(body.authorUrn ?? "").trim();
  }

  const validation = validateSocialPlatform(platform, next);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid platform configuration");
  }

  return { ...current, [platform]: next };
}
