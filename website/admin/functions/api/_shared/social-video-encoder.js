/**
 * SOCIAL-05 video encoder client.
 *
 * Cloudflare Pages cannot run ffmpeg. MP4 encode is opt-in via:
 *   1. Service binding `VIDEO_ENCODER` (Worker Fetcher) — preferred
 *   2. HTTP `video.encoderUrl` (+ optional `encoderApiKey`) in integrations:social-ai
 *
 * Encoder contract (POST /encode or POST encoderUrl):
 *   Request JSON: {
 *     tag, aspectRatio, secondsPerFrame, template,
 *     voiceover: { enabled, script } | null,
 *     frames: [{ index, caption, svg }]
 *   }
 *   Response JSON: {
 *     ok: true,
 *     contentType?: "video/mp4",
 *     videoBase64?: string,   // preferred for R2 upload
 *     videoUrl?: string       // remote URL if encoder hosts the file
 *   }
 */

/**
 * @param {string | null | undefined} tag
 * @param {string | null | undefined} caption
 */
export function buildVoiceoverScript(tag, caption) {
  const version = String(tag ?? "")
    .trim()
    .replace(/^v/i, "") || "release";
  const lines = String(caption ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, ""));
  const detailLines = lines.length > 1 ? lines.slice(1) : lines;
  const body = detailLines.slice(0, 5).join(". ") || `Cursor Curse Monitor version ${version}.`;
  return `Cursor Curse Monitor ${version} by Lorapok Labs. ${body}`.replace(/\s+/g, " ").trim().slice(0, 800);
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} video
 * @returns {{ kind: "service" | "http"; fetch: typeof fetch; url: string; apiKey: string | null } | null}
 */
export function resolveVideoEncoder(env, video = {}) {
  const service = env?.VIDEO_ENCODER;
  if (service && typeof service.fetch === "function") {
    return {
      kind: "service",
      fetch: (input, init) => service.fetch(input, init),
      url: "https://video-encoder/encode",
      apiKey: null,
    };
  }

  const encoderUrl = String(video?.encoderUrl ?? env?.VIDEO_ENCODER_URL ?? "").trim();
  if (!encoderUrl) return null;
  let parsed;
  try {
    parsed = new URL(encoderUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const apiKey = String(video?.encoderApiKey ?? env?.VIDEO_ENCODER_API_KEY ?? "").trim() || null;
  return {
    kind: "http",
    fetch: globalThis.fetch.bind(globalThis),
    url: encoderUrl,
    apiKey,
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} video
 */
export function isVideoEncoderAvailable(env, video = {}) {
  return resolveVideoEncoder(env, video) != null;
}

/**
 * @param {{ kind: string; fetch: Function; url: string; apiKey: string | null }} encoder
 * @param {{
 *   tag: string;
 *   aspectRatio: string;
 *   secondsPerFrame: number;
 *   template: string;
 *   voiceoverEnabled: boolean;
 *   voiceoverScript: string | null;
 *   frames: Array<{ index: number; caption: string; svg: string }>;
 * }} payload
 */
export async function requestVideoEncode(encoder, payload) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (encoder.apiKey) {
    headers.Authorization = `Bearer ${encoder.apiKey}`;
  }

  const body = {
    tag: payload.tag,
    aspectRatio: payload.aspectRatio,
    secondsPerFrame: payload.secondsPerFrame,
    template: payload.template,
    voiceover: payload.voiceoverEnabled
      ? { enabled: true, script: payload.voiceoverScript ?? "" }
      : { enabled: false, script: null },
    frames: (payload.frames ?? []).map((frame) => ({
      index: frame.index,
      caption: frame.caption,
      svg: frame.svg,
    })),
  };

  const response = await encoder.fetch(encoder.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Video encoder failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ""}`
    );
  }

  const result = await response.json();
  if (!result || result.ok === false) {
    throw new Error(String(result?.error ?? "Video encoder returned ok:false"));
  }

  const contentType = String(result.contentType ?? "video/mp4");
  let bytes = null;
  if (typeof result.videoBase64 === "string" && result.videoBase64.trim()) {
    const binary = atob(result.videoBase64.trim());
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    bytes = out.buffer;
  }

  const videoUrl = typeof result.videoUrl === "string" && result.videoUrl.trim() ? result.videoUrl.trim() : null;
  if (!bytes && !videoUrl) {
    throw new Error("Video encoder response missing videoBase64 and videoUrl");
  }

  return {
    ok: true,
    contentType,
    bytes,
    videoUrl,
    encoderKind: encoder.kind,
  };
}
