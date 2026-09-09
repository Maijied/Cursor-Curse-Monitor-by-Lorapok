import { putKvJsonIfChanged } from "./kv-put.js";

export const SEO_CONFIG_KEY = "integrations:seo";

/** Search / analytics providers under Settings → SEO (SEO-02). */
export const SEO_PROVIDERS = [
  "googleSearchConsole",
  "bingWebmaster",
  "azureWebmaster",
  "cloudflareAnalytics",
  "pageSpeedInsights",
];

const HTTPS_URL_RE = /^https:\/\/[\w.-]+(?:\/[\w./%-]*)?$/i;

/**
 * @param {string | null | undefined} value
 */
export function maskSeoSecret(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (text.length <= 4) return "configured";
  return `···${text.slice(-4)}`;
}

function emptyHubConfig() {
  return {
    sitemapUrl: "",
    robotsNotes: "",
  };
}

function emptyPlatformConfig() {
  return {
    googleSearchConsole: { enabled: false, siteUrl: "", serviceAccountJson: "" },
    bingWebmaster: { enabled: false, siteUrl: "", apiKey: "" },
    azureWebmaster: { enabled: false, siteUrl: "", apiKey: "" },
    cloudflareAnalytics: { enabled: false, zoneId: "", apiToken: "", siteUrl: "" },
    pageSpeedInsights: { enabled: false, apiKey: "", siteUrl: "" },
    hub: emptyHubConfig(),
    updatedAt: null,
    updatedBy: null,
  };
}

/**
 * @param {string} provider
 * @param {Record<string, unknown>} data
 */
export function validateSeoProvider(provider, data) {
  const enabled = Boolean(data.enabled);
  if (!enabled) return { ok: true, enabled: false };

  switch (provider) {
    case "googleSearchConsole": {
      const siteUrl = String(data.siteUrl ?? "").trim().replace(/\/+$/, "");
      if (!siteUrl || !HTTPS_URL_RE.test(siteUrl)) {
        return { ok: false, error: "Google Search Console site URL must be https://" };
      }
      return { ok: true, enabled: true };
    }
    case "bingWebmaster":
    case "azureWebmaster": {
      const siteUrl = String(data.siteUrl ?? "").trim().replace(/\/+$/, "");
      const apiKey = String(data.apiKey ?? "").trim();
      if (!siteUrl || !HTTPS_URL_RE.test(siteUrl)) {
        return { ok: false, error: `${provider} site URL must be https://` };
      }
      if (!apiKey) return { ok: false, error: `${provider} API key is required when enabled` };
      return { ok: true, enabled: true };
    }
    case "cloudflareAnalytics": {
      const zoneId = String(data.zoneId ?? "").trim();
      const apiToken = String(data.apiToken ?? "").trim();
      const siteUrl = String(data.siteUrl ?? "").trim().replace(/\/+$/, "");
      if (!zoneId) return { ok: false, error: "Cloudflare zone ID is required when enabled" };
      if (!apiToken) return { ok: false, error: "Cloudflare API token is required when enabled" };
      if (siteUrl && !HTTPS_URL_RE.test(siteUrl)) {
        return { ok: false, error: "Cloudflare site URL must be https://" };
      }
      return { ok: true, enabled: true };
    }
    case "pageSpeedInsights": {
      const apiKey = String(data.apiKey ?? "").trim();
      const siteUrl = String(data.siteUrl ?? "").trim().replace(/\/+$/, "");
      if (!apiKey) return { ok: false, error: "PageSpeed Insights API key is required when enabled" };
      if (!siteUrl || !HTTPS_URL_RE.test(siteUrl)) {
        return { ok: false, error: "PageSpeed site URL must be https://" };
      }
      return { ok: true, enabled: true };
    }
    default:
      return { ok: false, error: "Unknown provider" };
  }
}

/**
 * @param {Record<string, unknown>} hub
 */
export function validateSeoHub(hub) {
  const sitemapUrl = String(hub?.sitemapUrl ?? "").trim();
  if (sitemapUrl && !HTTPS_URL_RE.test(sitemapUrl)) {
    return { ok: false, error: "Sitemap URL must be https://" };
  }
  return { ok: true };
}

/**
 * @param {Record<string, unknown>} parsed
 */
function normalizeStoredConfig(parsed) {
  const base = emptyPlatformConfig();
  for (const provider of SEO_PROVIDERS) {
    const stored = parsed?.[provider];
    if (!stored || typeof stored !== "object") continue;
    base[provider] = {
      ...base[provider],
      enabled: Boolean(stored.enabled),
      ...(provider === "googleSearchConsole"
        ? {
            siteUrl: String(stored.siteUrl ?? "").replace(/\/+$/, ""),
            serviceAccountJson: String(stored.serviceAccountJson ?? ""),
          }
        : provider === "bingWebmaster" || provider === "azureWebmaster"
          ? {
              siteUrl: String(stored.siteUrl ?? "").replace(/\/+$/, ""),
              apiKey: String(stored.apiKey ?? ""),
            }
          : provider === "cloudflareAnalytics"
            ? {
                zoneId: String(stored.zoneId ?? ""),
                apiToken: String(stored.apiToken ?? ""),
                siteUrl: String(stored.siteUrl ?? "").replace(/\/+$/, ""),
              }
            : {
                apiKey: String(stored.apiKey ?? ""),
                siteUrl: String(stored.siteUrl ?? "").replace(/\/+$/, ""),
              }),
    };
  }
  const hub = parsed?.hub;
  if (hub && typeof hub === "object") {
    base.hub = {
      sitemapUrl: String(hub.sitemapUrl ?? "").trim(),
      robotsNotes: String(hub.robotsNotes ?? "").trim(),
    };
  }
  base.updatedAt = parsed?.updatedAt ?? null;
  base.updatedBy = parsed?.updatedBy ?? null;
  return base;
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readSeoConfig(env) {
  if (!env?.ADMIN_KV?.get) return emptyPlatformConfig();
  try {
    const raw = await env.ADMIN_KV.get(SEO_CONFIG_KEY);
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
export async function writeSeoConfig(env, config) {
  if (!env?.ADMIN_KV?.put) throw new Error("ADMIN_KV binding not configured");
  await putKvJsonIfChanged(env, SEO_CONFIG_KEY, config);
}

/**
 * @param {string} provider
 * @param {Record<string, unknown>} config
 */
export function sanitizeSeoProviderForClient(provider, config) {
  const data = config?.[provider] ?? {};
  const validation = validateSeoProvider(provider, data);
  const common = {
    enabled: Boolean(data.enabled),
    configured: validation.ok && validation.enabled === true,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };

  switch (provider) {
    case "googleSearchConsole":
      return {
        ...common,
        siteUrl: data.siteUrl ? String(data.siteUrl) : "",
        serviceAccountPreview: data.serviceAccountJson
          ? maskSeoSecret(data.serviceAccountJson)
          : null,
      };
    case "bingWebmaster":
    case "azureWebmaster":
      return {
        ...common,
        siteUrl: data.siteUrl ? String(data.siteUrl) : "",
        apiKeyPreview: data.apiKey ? maskSeoSecret(data.apiKey) : null,
      };
    case "cloudflareAnalytics":
      return {
        ...common,
        zoneId: data.zoneId ? String(data.zoneId) : "",
        siteUrl: data.siteUrl ? String(data.siteUrl) : "",
        apiTokenPreview: data.apiToken ? maskSeoSecret(data.apiToken) : null,
      };
    case "pageSpeedInsights":
      return {
        ...common,
        siteUrl: data.siteUrl ? String(data.siteUrl) : "",
        apiKeyPreview: data.apiKey ? maskSeoSecret(data.apiKey) : null,
      };
    default:
      return common;
  }
}

/**
 * @param {Record<string, unknown>} config
 */
export function sanitizeSeoHubForClient(config) {
  const hub = config?.hub ?? emptyHubConfig();
  return {
    sitemapUrl: hub.sitemapUrl ? String(hub.sitemapUrl) : "",
    robotsNotes: hub.robotsNotes ? String(hub.robotsNotes) : "",
  };
}

/**
 * @param {Record<string, unknown>} config
 */
export function sanitizeSeoConfigForClient(config) {
  /** @type {Record<string, unknown>} */
  const providers = {};
  for (const provider of SEO_PROVIDERS) {
    providers[provider] = sanitizeSeoProviderForClient(provider, config);
  }
  const enabledCount = SEO_PROVIDERS.filter(
    (provider) => providers[provider].configured
  ).length;
  return {
    providers,
    hub: sanitizeSeoHubForClient(config),
    enabledCount,
    configured: enabledCount > 0,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} current
 * @param {string} provider
 * @param {Record<string, unknown>} body
 */
export function mergeSeoProviderUpdate(current, provider, body) {
  if (!SEO_PROVIDERS.includes(provider)) {
    throw new Error("Unknown provider");
  }
  const prev = current[provider] ?? {};
  const next = { ...prev };

  if (body.enabled !== undefined) next.enabled = Boolean(body.enabled);

  if (provider === "googleSearchConsole") {
    if (body.siteUrl !== undefined) next.siteUrl = String(body.siteUrl ?? "").trim().replace(/\/+$/, "");
    if (body.serviceAccountJson !== undefined && String(body.serviceAccountJson).trim()) {
      next.serviceAccountJson = String(body.serviceAccountJson).trim();
    }
  } else if (provider === "bingWebmaster" || provider === "azureWebmaster") {
    if (body.siteUrl !== undefined) next.siteUrl = String(body.siteUrl ?? "").trim().replace(/\/+$/, "");
    if (body.apiKey !== undefined && String(body.apiKey).trim()) {
      next.apiKey = String(body.apiKey).trim();
    }
  } else if (provider === "cloudflareAnalytics") {
    if (body.zoneId !== undefined) next.zoneId = String(body.zoneId ?? "").trim();
    if (body.siteUrl !== undefined) next.siteUrl = String(body.siteUrl ?? "").trim().replace(/\/+$/, "");
    if (body.apiToken !== undefined && String(body.apiToken).trim()) {
      next.apiToken = String(body.apiToken).trim();
    }
  } else if (provider === "pageSpeedInsights") {
    if (body.siteUrl !== undefined) next.siteUrl = String(body.siteUrl ?? "").trim().replace(/\/+$/, "");
    if (body.apiKey !== undefined && String(body.apiKey).trim()) {
      next.apiKey = String(body.apiKey).trim();
    }
  }

  const validation = validateSeoProvider(provider, next);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid provider configuration");
  }

  return { ...current, [provider]: next };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} body
 */
export function mergeSeoHubUpdate(current, body) {
  const prev = current.hub ?? emptyHubConfig();
  const next = { ...prev };
  if (body.sitemapUrl !== undefined) next.sitemapUrl = String(body.sitemapUrl ?? "").trim();
  if (body.robotsNotes !== undefined) next.robotsNotes = String(body.robotsNotes ?? "").trim();
  const validation = validateSeoHub(next);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid hub configuration");
  }
  return { ...current, hub: next };
}
