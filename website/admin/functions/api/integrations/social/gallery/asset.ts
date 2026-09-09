import { readSocialGallerySvg, buildSocialGallerySvg } from "../../../_shared/social-gallery-artifacts.js";
import { readSocialGalleryItem } from "../../../_shared/social-gallery-queue.js";

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
};

/**
 * Public Lorapok social gallery asset (SVG) for platform fetchers.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") ?? "").trim();
  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  let svg = await readSocialGallerySvg(env, id);
  if (!svg) {
    const item = await readSocialGalleryItem(env, id);
    if (item) {
      svg = buildSocialGallerySvg(item.tag, item.caption);
    }
  }

  if (!svg) {
    return new Response("Asset not found", { status: 404 });
  }

  return new Response(svg, { status: 200, headers: CACHE_HEADERS });
}
