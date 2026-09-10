import { normalizeTag } from "./discord-deploy-context.js";
import { buildSocialGallerySvg } from "./social-gallery-artifacts.js";
import { readSocialAiConfig, resolveActiveProvider } from "./social-ai-config.js";

/**
 * @param {string | null | undefined} tag
 * @param {string | null | undefined} caption
 * @param {Record<string, unknown>} provider
 */
export function buildImagePrompt(tag, caption, provider) {
  const version = normalizeTag(tag).replace(/^v/i, "") || "release";
  const prefix = String(provider?.promptPrefix ?? "").trim();
  const excerpt = String(caption ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join("; ");
  const parts = [prefix, `version ${version}`, excerpt].filter(Boolean);
  return parts.join(". ").slice(0, 900);
}

/**
 * @param {string} aspectRatio
 */
export function dimensionsForAspectRatio(aspectRatio) {
  switch (aspectRatio) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

/**
 * @param {string | null | undefined} tag
 * @param {string | null | undefined} caption
 * @param {string} aspectRatio
 */
export function buildCarouselFrames(tag, caption, aspectRatio = "9:16") {
  const dimensions = dimensionsForAspectRatio(aspectRatio);
  const lines = String(caption ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines.filter((line) => /^[-*]/.test(line));
  const frames =
    bullets.length > 0
      ? bullets.slice(0, 5)
      : lines.slice(0, 3).length > 0
        ? lines.slice(0, 3)
        : [String(caption ?? normalizeTag(tag))];

  return frames.map((line, index) => ({
    index,
    svg: buildSocialGallerySvg(tag, `${normalizeTag(tag)}\n\n${line}`, dimensions),
    caption: line.replace(/^[-*]\s*/, ""),
  }));
}

/**
 * @param {Record<string, unknown>} provider
 * @param {string} prompt
 * @param {{ width: number; height: number }} dimensions
 */
async function generatePollinationsImage(provider, prompt, dimensions) {
  const model = String(provider.model ?? "flux").trim();
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${dimensions.width}&height=${dimensions.height}&model=${encodeURIComponent(model)}&nologo=true`;
  const response = await fetch(url, { headers: { Accept: "image/*" } });
  if (!response.ok) {
    throw new Error(`Pollinations request failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("Pollinations returned empty image");
  return { bytes, contentType, providerId: "pollinations" };
}

/**
 * @param {Record<string, unknown>} provider
 * @param {string} prompt
 * @param {{ width: number; height: number }} dimensions
 */
async function generateHuggingFaceImage(provider, prompt, dimensions) {
  const model = String(provider.model ?? "stabilityai/stable-diffusion-xl-base-1.0").trim();
  const apiKey = String(provider.apiKey ?? "").trim();
  if (!apiKey) throw new Error("Hugging Face API key is required");

  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify({ inputs: prompt }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Hugging Face request failed (${response.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("Hugging Face returned empty image");
  return {
    bytes,
    contentType: response.headers.get("content-type") ?? "image/png",
    providerId: "huggingface",
  };
}

/**
 * @param {Record<string, unknown>} provider
 * @param {string} prompt
 * @param {{ width: number; height: number }} dimensions
 */
async function generateOpenAiImage(provider, prompt, dimensions) {
  const apiKey = String(provider.apiKey ?? "").trim();
  if (!apiKey) throw new Error("OpenAI API key is required");
  const model = String(provider.model ?? "dall-e-3").trim();
  const size =
    dimensions.width === dimensions.height
      ? "1024x1024"
      : dimensions.height > dimensions.width
        ? "1024x1792"
        : "1792x1024";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message = detail?.error?.message ?? `status ${response.status}`;
    throw new Error(`OpenAI image request failed: ${message}`);
  }
  const payload = await response.json();
  const imageUrl = payload?.data?.[0]?.url;
  if (!imageUrl) throw new Error("OpenAI response missing image URL");
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error(`OpenAI image download failed (${imageRes.status})`);
  const bytes = await imageRes.arrayBuffer();
  return {
    bytes,
    contentType: imageRes.headers.get("content-type") ?? "image/png",
    providerId: "openai",
  };
}

/**
 * @param {Record<string, unknown>} provider
 * @param {string} prompt
 * @param {{ width: number; height: number }} dimensions
 */
async function generateWithProvider(provider, prompt, dimensions) {
  const id = String(provider?.id ?? provider?.type ?? "svg-fallback");
  if (id === "svg-fallback") {
    return {
      svg: buildSocialGallerySvg("v0", prompt, dimensions),
      contentType: "image/svg+xml; charset=utf-8",
      providerId: "svg-fallback",
    };
  }
  if (id === "pollinations" || provider?.type === "pollinations") {
    return generatePollinationsImage(provider, prompt, dimensions);
  }
  if (id === "huggingface" || provider?.type === "huggingface") {
    return generateHuggingFaceImage(provider, prompt, dimensions);
  }
  if (id === "openai" || provider?.type === "openai") {
    return generateOpenAiImage(provider, prompt, dimensions);
  }
  throw new Error(`Unsupported image provider: ${id}`);
}

/**
 * Generate a social gallery image using the active provider (SOCIAL-04).
 *
 * @param {Record<string, unknown>} env
 * @param {{ tag: string; caption?: string | null; aspectRatio?: string }} input
 */
export async function generateSocialGalleryImage(env, input) {
  const config = await readSocialAiConfig(env);
  const provider = resolveActiveProvider(config, config.activeProviderId);
  const aspectRatio = input.aspectRatio ?? config.video?.aspectRatio ?? "1:1";
  const dimensions = dimensionsForAspectRatio(aspectRatio);
  const prompt = buildImagePrompt(input.tag, input.caption, provider);

  try {
    const result = await generateWithProvider(provider, prompt, dimensions);
    return {
      ok: true,
      providerId: result.providerId,
      prompt,
      dimensions,
      ...result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    const svg = buildSocialGallerySvg(input.tag, input.caption, dimensions);
    return {
      ok: false,
      providerId: String(provider?.id ?? "svg-fallback"),
      prompt,
      dimensions,
      error: message,
      svg,
      contentType: "image/svg+xml; charset=utf-8",
      fallback: true,
    };
  }
}

/**
 * Build video carousel manifest (SOCIAL-05) — static frame sequence when no encoder is available.
 *
 * @param {Record<string, unknown>} env
 * @param {{ tag: string; caption?: string | null }} input
 */
export async function generateSocialVideoManifest(env, input) {
  const config = await readSocialAiConfig(env);
  const video = config.video ?? {};
  const aspectRatio = String(video.aspectRatio ?? "9:16");
  const frames = buildCarouselFrames(input.tag, input.caption, aspectRatio);

  return {
    enabled: Boolean(video.enabled),
    mode: video.enabled ? String(video.template ?? "carousel") : "disabled",
    fallbackMode: String(video.fallbackMode ?? "static-carousel"),
    voiceoverEnabled: Boolean(video.voiceoverEnabled),
    aspectRatio,
    frameCount: frames.length,
    frames,
    videoUrl: null,
    note: video.enabled
      ? "Static carousel manifest — MP4 encoding deferred; publish uses frame sequence."
      : "Video generator disabled — gallery uses single image only.",
  };
}
