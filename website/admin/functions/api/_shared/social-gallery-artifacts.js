import { normalizeTag } from "./discord-deploy-context.js";
import { putKvJsonSafe } from "./kv-put.js";
import { putStatsR2Text } from "./r2-stats.js";

export const SOCIAL_GALLERY_R2_PREFIX = "social-gallery/";
export const SOCIAL_GALLERY_SVG_KV_PREFIX = "social-gallery:svg:";

/** Lorapok social card palette (SOCIAL-02). */
export const SOCIAL_GALLERY_COLORS = {
  background: "#0b1020",
  accent: "#7c5cff",
  accent2: "#4d9fff",
  text: "#f8fafc",
  muted: "#94a3b8",
};

/**
 * @param {string | null | undefined} tag
 * @param {string | null | undefined} caption
 * @param {{ width?: number; height?: number }} [dimensions]
 */
export function buildSocialGallerySvg(tag, caption, dimensions = {}) {
  const width = dimensions.width ?? 1080;
  const height = dimensions.height ?? 1080;
  const version = normalizeTag(tag).replace(/^v/i, "") || "release";
  const lines = String(caption ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  const title = `Cursor Curse Monitor ${version}`;
  const bodyLines = lines.length > 1 ? lines.slice(1) : lines;
  const escapedTitle = escapeXml(title);
  const bodyTspans = bodyLines
    .slice(0, 4)
    .map((line, index) => {
      const y = 360 + index * 42;
      return `<tspan x="80" y="${y}">${escapeXml(line.replace(/^[-*]\s*/, ""))}</tspan>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapedTitle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${SOCIAL_GALLERY_COLORS.background}"/>
      <stop offset="100%" stop-color="#151b33"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${SOCIAL_GALLERY_COLORS.accent}"/>
      <stop offset="100%" stop-color="${SOCIAL_GALLERY_COLORS.accent2}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="48" fill="url(#bg)"/>
  <rect x="48" y="48" width="${width - 96}" height="8" rx="4" fill="url(#accent)"/>
  <text x="80" y="180" fill="${SOCIAL_GALLERY_COLORS.text}" font-size="54" font-family="system-ui,Segoe UI,sans-serif" font-weight="700">${escapedTitle}</text>
  <text x="80" y="250" fill="${SOCIAL_GALLERY_COLORS.muted}" font-size="28" font-family="system-ui,Segoe UI,sans-serif">Lorapok Labs · Mission Control deploy</text>
  <text fill="${SOCIAL_GALLERY_COLORS.text}" font-size="30" font-family="system-ui,Segoe UI,sans-serif">${bodyTspans}</text>
  <text x="80" y="${height - 72}" fill="${SOCIAL_GALLERY_COLORS.muted}" font-size="24" font-family="system-ui,Segoe UI,sans-serif">cursor.lorapok.tech</text>
</svg>`;
}

/**
 * @param {string} value
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} id
 */
export function socialGalleryAssetPublicUrl(env, id) {
  const base = String(env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech").replace(/\/$/, "");
  return `${base}/api/integrations/social/gallery/asset?id=${encodeURIComponent(id)}`;
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ id: string; tag: string; caption?: string | null }} item
 */
/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {ArrayBuffer | string} body
 * @param {string} contentType
 */
async function putGalleryR2Asset(env, key, body, contentType) {
  const bucket = env?.STATS_R2;
  if (!bucket?.put) return false;
  try {
    await bucket.put(key, body, { httpMetadata: { contentType } });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ id: string; tag: string; caption?: string | null }} item
 * @param {{
 *   bytes?: ArrayBuffer | null;
 *   svg?: string | null;
 *   contentType?: string;
 *   providerId?: string | null;
 *   imageFallback?: boolean;
 *   videoManifest?: Record<string, unknown> | null;
 * }} [generated]
 */
export async function writeSocialGalleryArtifact(env, item, generated = {}) {
  let svg = generated.svg ?? null;
  let contentType = generated.contentType ?? "image/svg+xml; charset=utf-8";
  let extension = contentType.includes("svg") ? "svg" : "png";
  let r2Body = generated.bytes ?? svg;

  if (!r2Body) {
    svg = buildSocialGallerySvg(item.tag, item.caption, { width: 1080, height: 1080 });
    contentType = "image/svg+xml; charset=utf-8";
    extension = "svg";
    r2Body = svg;
  }

  const videoManifest = generated.videoManifest ?? null;

  const r2Key = `${SOCIAL_GALLERY_R2_PREFIX}${normalizeTag(item.tag)}/${item.id}.${extension}`;
  const r2Written = await putGalleryR2Asset(env, r2Key, r2Body, contentType);

  if (!r2Written && env.ADMIN_KV?.put) {
    if (generated.bytes && r2Body) {
      const bytes = new Uint8Array(generated.bytes);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      await putKvJsonSafe(env, `${SOCIAL_GALLERY_SVG_KV_PREFIX}${item.id}`, {
        base64: btoa(binary),
        contentType,
        tag: item.tag,
        providerId: generated.providerId,
      });
    } else {
      await putKvJsonSafe(env, `${SOCIAL_GALLERY_SVG_KV_PREFIX}${item.id}`, {
        svg,
        contentType,
        tag: item.tag,
        providerId: generated.providerId,
      });
    }
    if (videoManifest?.enabled) {
      await putKvJsonSafe(env, `social-gallery:video:${item.id}`, videoManifest);
    }
  }

  return {
    svg,
    contentType,
    providerId: generated.providerId ?? "svg-fallback",
    imageFallback: Boolean(generated.imageFallback),
    videoManifest,
    r2Key: r2Written ? r2Key : null,
    imageUrl: socialGalleryAssetPublicUrl(env, item.id),
    storage: r2Written ? "r2" : env.ADMIN_KV?.put ? "kv" : "inline",
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} id
 */
/**
 * @param {Record<string, unknown>} env
 * @param {string} id
 */
export async function readSocialGalleryAssetMeta(env, id) {
  if (env.ADMIN_KV?.get) {
    const raw = await env.ADMIN_KV.get(`${SOCIAL_GALLERY_SVG_KV_PREFIX}${id}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          contentType: parsed.contentType ?? "image/svg+xml; charset=utf-8",
          svg: parsed.svg ?? null,
          base64: parsed.base64 ?? null,
        };
      } catch {
        /* fall through */
      }
    }
  }
  return null;
}

export async function readSocialGallerySvg(env, id) {
  const r2KeyPrefix = SOCIAL_GALLERY_R2_PREFIX;
  if (env.STATS_R2?.get) {
    const indexRaw = env.ADMIN_KV?.get ? await env.ADMIN_KV.get(`social-gallery:item:${id}`) : null;
    if (indexRaw) {
      try {
        const item = JSON.parse(indexRaw);
        for (const extension of ["svg", "png", "jpg", "jpeg", "webp"]) {
          const r2Key = `${r2KeyPrefix}${normalizeTag(item.tag)}/${id}.${extension}`;
          const obj = await env.STATS_R2.get(r2Key);
          if (obj) {
            const contentType = obj.httpMetadata?.contentType ?? "";
            if (contentType.includes("svg")) return obj.text();
          }
        }
      } catch {
        /* fall through */
      }
    }
  }

  const meta = await readSocialGalleryAssetMeta(env, id);
  if (meta?.svg) return meta.svg;
  return null;
}
