import { putKvJsonIfChanged } from "./kv-put.js";

export const SOCIAL_AI_CONFIG_KEY = "integrations:social-ai";

/** Built-in image providers (SOCIAL-04). Exactly one may be active at a time. */
export const BUILTIN_IMAGE_PROVIDERS = ["svg-fallback", "pollinations", "huggingface", "openai"];

/**
 * @typedef {"svg-fallback" | "pollinations" | "huggingface" | "openai" | string} SocialImageProviderId
 */

/**
 * @param {string | null | undefined} value
 */
export function maskSocialAiSecret(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (text.length <= 4) return "configured";
  return `···${text.slice(-4)}`;
}

function emptyProvider(id, label, tier = "free") {
  return {
    id,
    label,
    tier,
    apiKey: "",
    model: "",
    promptPrefix: "Lorapok Labs futuristic deploy card, purple and blue gradient, minimal UI, no text",
    enabled: id === "svg-fallback",
  };
}

function emptyVideoConfig() {
  return {
    enabled: false,
    template: "carousel",
    aspectRatio: "9:16",
    voiceoverEnabled: false,
    fallbackMode: "static-carousel",
  };
}

function emptyConfig() {
  return {
    activeProviderId: "svg-fallback",
    providers: {
      "svg-fallback": emptyProvider("svg-fallback", "SVG template (built-in)", "free"),
      pollinations: {
        ...emptyProvider("pollinations", "Pollinations.ai (free)", "free"),
        model: "flux",
      },
      huggingface: {
        ...emptyProvider("huggingface", "Hugging Face Inference", "paid"),
        model: "stabilityai/stable-diffusion-xl-base-1.0",
      },
      openai: {
        ...emptyProvider("openai", "OpenAI DALL·E", "paid"),
        model: "dall-e-3",
      },
    },
    customProviders: [],
    video: emptyVideoConfig(),
    updatedAt: null,
    updatedBy: null,
  };
}

/**
 * @param {Record<string, unknown>} provider
 */
export function validateImageProvider(provider) {
  const id = String(provider?.id ?? "").trim();
  if (!id) return { ok: false, error: "Provider id is required" };

  const tier = String(provider?.tier ?? "free");
  const apiKey = String(provider?.apiKey ?? "").trim();

  if (id === "svg-fallback") {
    return { ok: true, id, tier: "free" };
  }
  if (id === "pollinations") {
    return { ok: true, id, tier: "free" };
  }
  if (id === "huggingface" || id === "openai" || tier === "paid") {
    if (!apiKey) return { ok: false, error: `${id} API key is required` };
    return { ok: true, id, tier };
  }
  return { ok: true, id, tier };
}

/**
 * @param {Record<string, unknown>} video
 */
export function validateVideoConfig(video) {
  const template = String(video?.template ?? "carousel");
  if (!["carousel", "slideshow"].includes(template)) {
    return { ok: false, error: "Video template must be carousel or slideshow" };
  }
  const aspectRatio = String(video?.aspectRatio ?? "9:16");
  if (!["9:16", "1:1", "16:9"].includes(aspectRatio)) {
    return { ok: false, error: "Aspect ratio must be 9:16, 1:1, or 16:9" };
  }
  return { ok: true };
}

/**
 * @param {Record<string, unknown>} parsed
 */
function normalizeStoredConfig(parsed) {
  const base = emptyConfig();
  if (parsed?.activeProviderId) {
    base.activeProviderId = String(parsed.activeProviderId);
  }

  for (const id of BUILTIN_IMAGE_PROVIDERS) {
    const stored = parsed?.providers?.[id];
    if (!stored || typeof stored !== "object") continue;
    base.providers[id] = {
      ...base.providers[id],
      ...stored,
      id,
      apiKey: String(stored.apiKey ?? base.providers[id].apiKey ?? ""),
      model: String(stored.model ?? base.providers[id].model ?? ""),
      promptPrefix: String(stored.promptPrefix ?? base.providers[id].promptPrefix ?? ""),
      label: String(stored.label ?? base.providers[id].label ?? id),
      tier: String(stored.tier ?? base.providers[id].tier ?? "free"),
      enabled: Boolean(stored.enabled),
    };
  }

  if (Array.isArray(parsed?.customProviders)) {
    base.customProviders = parsed.customProviders
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        id: String(entry.id ?? "").trim(),
        label: String(entry.label ?? "Custom provider").trim(),
        tier: String(entry.tier ?? "paid"),
        type: String(entry.type ?? "pollinations"),
        apiKey: String(entry.apiKey ?? ""),
        model: String(entry.model ?? ""),
        promptPrefix: String(entry.promptPrefix ?? base.providers.pollinations.promptPrefix),
        enabled: Boolean(entry.enabled),
      }))
      .filter((entry) => entry.id);
  }

  const video = parsed?.video;
  if (video && typeof video === "object") {
    base.video = {
      ...base.video,
      enabled: Boolean(video.enabled),
      template: String(video.template ?? base.video.template),
      aspectRatio: String(video.aspectRatio ?? base.video.aspectRatio),
      voiceoverEnabled: Boolean(video.voiceoverEnabled),
      fallbackMode: String(video.fallbackMode ?? base.video.fallbackMode),
    };
  }

  base.updatedAt = parsed?.updatedAt ?? null;
  base.updatedBy = parsed?.updatedBy ?? null;
  return base;
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readSocialAiConfig(env) {
  if (!env?.ADMIN_KV?.get) return emptyConfig();
  try {
    const raw = await env.ADMIN_KV.get(SOCIAL_AI_CONFIG_KEY);
    if (!raw) return emptyConfig();
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return emptyConfig();
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} config
 */
export async function writeSocialAiConfig(env, config) {
  if (!env?.ADMIN_KV?.put) throw new Error("ADMIN_KV binding not configured");
  await putKvJsonIfChanged(env, SOCIAL_AI_CONFIG_KEY, config);
}

/**
 * @param {Record<string, unknown>} config
 * @param {string} providerId
 */
export function resolveActiveProvider(config, providerId) {
  const id = providerId || config.activeProviderId || "svg-fallback";
  if (BUILTIN_IMAGE_PROVIDERS.includes(id)) {
    return config.providers?.[id] ?? emptyConfig().providers[id];
  }
  return (config.customProviders ?? []).find((entry) => entry.id === id) ?? null;
}

/**
 * @param {Record<string, unknown>} config
 */
export function listAllProviders(config) {
  const builtins = BUILTIN_IMAGE_PROVIDERS.map((id) => ({
    ...config.providers[id],
    id,
    builtin: true,
  }));
  const custom = (config.customProviders ?? []).map((entry) => ({
    ...entry,
    builtin: false,
  }));
  return [...builtins, ...custom];
}

/**
 * @param {Record<string, unknown>} config
 */
export function sanitizeSocialAiConfigForClient(config) {
  const activeProviderId = String(config.activeProviderId ?? "svg-fallback");
  const providers = listAllProviders(config).map((provider) => {
    const validation = validateImageProvider(provider);
    return {
      id: provider.id,
      label: provider.label,
      tier: provider.tier ?? "free",
      builtin: Boolean(provider.builtin),
      type: provider.type ?? provider.id,
      model: provider.model ? String(provider.model) : "",
      promptPrefix: provider.promptPrefix ? String(provider.promptPrefix) : "",
      active: provider.id === activeProviderId,
      configured:
        provider.id === "svg-fallback" ||
        provider.id === "pollinations" ||
        (validation.ok && (provider.tier !== "paid" || Boolean(provider.apiKey))),
      apiKeyPreview: provider.apiKey ? maskSocialAiSecret(provider.apiKey) : null,
    };
  });

  const video = config.video ?? emptyVideoConfig();
  const videoValidation = validateVideoConfig(video);

  return {
    activeProviderId,
    providers,
    video: {
      enabled: Boolean(video.enabled),
      template: String(video.template ?? "carousel"),
      aspectRatio: String(video.aspectRatio ?? "9:16"),
      voiceoverEnabled: Boolean(video.voiceoverEnabled),
      fallbackMode: String(video.fallbackMode ?? "static-carousel"),
      configured: videoValidation.ok,
    },
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} body
 */
export function mergeSocialAiProviderUpdate(current, body) {
  const providerId = String(body.providerId ?? body.provider ?? "").trim();
  if (!providerId) throw new Error("providerId is required");

  const next = { ...current };
  const isBuiltin = BUILTIN_IMAGE_PROVIDERS.includes(providerId);

  if (isBuiltin) {
    const prev = current.providers?.[providerId] ?? emptyConfig().providers[providerId];
    const updated = { ...prev };
    if (body.label !== undefined) updated.label = String(body.label ?? "").trim();
    if (body.model !== undefined) updated.model = String(body.model ?? "").trim();
    if (body.promptPrefix !== undefined) updated.promptPrefix = String(body.promptPrefix ?? "").trim();
    if (body.apiKey !== undefined && String(body.apiKey).trim()) {
      updated.apiKey = String(body.apiKey).trim();
    }
    if (body.enabled !== undefined) updated.enabled = Boolean(body.enabled);
    const validation = validateImageProvider(updated);
    if (!validation.ok) throw new Error(validation.error ?? "Invalid provider");
    next.providers = { ...current.providers, [providerId]: updated };
  } else {
    const custom = [...(current.customProviders ?? [])];
    const index = custom.findIndex((entry) => entry.id === providerId);
    const prev =
      index >= 0
        ? custom[index]
        : {
            id: providerId,
            label: String(body.label ?? providerId),
            tier: "paid",
            type: String(body.type ?? "pollinations"),
            apiKey: "",
            model: "",
            promptPrefix: current.providers?.pollinations?.promptPrefix ?? "",
            enabled: false,
          };
    const updated = { ...prev };
    if (body.label !== undefined) updated.label = String(body.label ?? "").trim();
    if (body.type !== undefined) updated.type = String(body.type ?? "pollinations");
    if (body.model !== undefined) updated.model = String(body.model ?? "").trim();
    if (body.promptPrefix !== undefined) updated.promptPrefix = String(body.promptPrefix ?? "").trim();
    if (body.apiKey !== undefined && String(body.apiKey).trim()) {
      updated.apiKey = String(body.apiKey).trim();
    }
    if (body.enabled !== undefined) updated.enabled = Boolean(body.enabled);
    const validation = validateImageProvider(updated);
    if (!validation.ok) throw new Error(validation.error ?? "Invalid custom provider");
    if (index >= 0) custom[index] = updated;
    else custom.push(updated);
    next.customProviders = custom;
  }

  if (body.activate === true) {
    next.activeProviderId = providerId;
  }

  return next;
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} body
 */
export function mergeSocialAiVideoUpdate(current, body) {
  const prev = current.video ?? emptyVideoConfig();
  const nextVideo = {
    ...prev,
    ...(body.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
    ...(body.template !== undefined ? { template: String(body.template) } : {}),
    ...(body.aspectRatio !== undefined ? { aspectRatio: String(body.aspectRatio) } : {}),
    ...(body.voiceoverEnabled !== undefined
      ? { voiceoverEnabled: Boolean(body.voiceoverEnabled) }
      : {}),
    ...(body.fallbackMode !== undefined ? { fallbackMode: String(body.fallbackMode) } : {}),
  };
  const validation = validateVideoConfig(nextVideo);
  if (!validation.ok) throw new Error(validation.error ?? "Invalid video configuration");
  return { ...current, video: nextVideo };
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} body
 */
export function mergeSocialAiConfigUpdate(current, body) {
  const section = String(body.section ?? "").trim();
  if (section === "video") {
    return mergeSocialAiVideoUpdate(current, body);
  }
  if (body.activeProviderId !== undefined) {
    const id = String(body.activeProviderId).trim();
    const known = listAllProviders(current).some((entry) => entry.id === id);
    if (!known) throw new Error("Unknown active provider id");
    return { ...current, activeProviderId: id };
  }
  return mergeSocialAiProviderUpdate(current, body);
}
