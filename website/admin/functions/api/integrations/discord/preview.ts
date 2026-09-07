import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import {
  DISCORD_GALLERY_ITEMS,
  buildDiscordGalleryPreview,
  listDiscordGalleryPreviews,
} from "../../_shared/discord-card-gallery.js";
import { sanitizeDiscordConfigForClient, readDiscordConfig } from "../../_shared/discord-config.js";

/**
 * Preview Lorapok Discord card templates for Settings gallery (DC-07).
 * GET ?card=deploy-success — single card preview
 * GET (no card) — all gallery previews
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.read");
  if (denied) return denied;

  const url = new URL(request.url);
  const cardId = url.searchParams.get("card");

  const config = await readDiscordConfig(env);
  const clientConfig = sanitizeDiscordConfigForClient(config);

  if (cardId) {
    const preview = await buildDiscordGalleryPreview(env, cardId);
    if (!preview) {
      return jsonResponse({ error: "Unknown card id" }, 404);
    }
    return jsonResponse({
      ok: true,
      card: preview.item,
      embed: preview.embed,
      config: clientConfig,
    });
  }

  const previews = await listDiscordGalleryPreviews(env);
  return jsonResponse({
    ok: true,
    items: DISCORD_GALLERY_ITEMS,
    previews: previews.map((entry) => ({
      card: entry.item,
      embed: entry.embed,
    })),
    config: clientConfig,
  });
}
