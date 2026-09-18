import {
  readSocialGalleryAssetMeta,
  readSocialGallerySvg,
  buildSocialGallerySvg,
  SOCIAL_GALLERY_R2_PREFIX,
} from "../../../_shared/social-gallery-artifacts.js";
import { normalizeTag } from "../../../_shared/discord-deploy-context.js";
import { readSocialGalleryItem } from "../../../_shared/social-gallery-queue.js";

const CACHE_BASE = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
};

/**
 * Public Lorapok social gallery asset (image SVG/PNG or encoded MP4 when kind=video).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") ?? "").trim();
  const kind = String(url.searchParams.get("kind") ?? "image").trim().toLowerCase();
  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  if (kind === "video") {
    const item = await readSocialGalleryItem(env, id);
    const r2Key =
      item?.videoManifest?.videoR2Key ??
      (item?.tag ? `${SOCIAL_GALLERY_R2_PREFIX}${normalizeTag(item.tag)}/${id}.mp4` : null);
    if (r2Key && env.STATS_R2?.get) {
      const obj = await env.STATS_R2.get(r2Key);
      if (obj) {
        return new Response(obj.body, {
          status: 200,
          headers: {
            ...CACHE_BASE,
            "Content-Type": obj.httpMetadata?.contentType ?? "video/mp4",
          },
        });
      }
    }
    if (item?.videoUrl && !String(item.videoUrl).includes("/api/integrations/social/gallery/asset")) {
      return Response.redirect(String(item.videoUrl), 302);
    }
    return new Response("Video not found", { status: 404 });
  }

  const meta = await readSocialGalleryAssetMeta(env, id);
  if (meta?.base64) {
    const binary = Uint8Array.from(atob(meta.base64), (char) => char.charCodeAt(0));
    return new Response(binary, {
      status: 200,
      headers: {
        ...CACHE_BASE,
        "Content-Type": meta.contentType ?? "image/png",
      },
    });
  }

  let svg = meta?.svg ?? (await readSocialGallerySvg(env, id));
  if (!svg) {
    const item = await readSocialGalleryItem(env, id);
    if (item) {
      svg = buildSocialGallerySvg(item.tag, item.caption);
    }
  }

  if (!svg) {
    return new Response("Asset not found", { status: 404 });
  }

  return new Response(svg, {
    status: 200,
    headers: {
      ...CACHE_BASE,
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
