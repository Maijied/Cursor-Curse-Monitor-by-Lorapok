import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import {
  MAIL_GALLERY_ITEMS,
  buildMailGalleryPreview,
  getMailGalleryMeta,
  listMailGalleryPreviews,
} from "../../_shared/mail-card-gallery.js";

/**
 * Preview Lorapok mail templates for Settings / Mail gallery (MAIL-13).
 * GET ?template=subscribe-welcome — single template preview
 * GET (no template) — all gallery previews
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "mail.read");
  if (denied) return denied;

  const url = new URL(request.url);
  const templateId = url.searchParams.get("template");

  const meta = await getMailGalleryMeta(env);

  if (templateId) {
    const preview = await buildMailGalleryPreview(env, templateId);
    if (!preview) {
      return jsonResponse({ error: "Unknown template id" }, 404);
    }
    return jsonResponse({
      ok: true,
      template: preview.item,
      preview: preview.preview,
      ...meta,
    });
  }

  const previews = await listMailGalleryPreviews(env);
  return jsonResponse({
    ok: true,
    items: MAIL_GALLERY_ITEMS,
    previews: previews.map((entry) => ({
      template: entry.item,
      preview: entry.preview,
    })),
    ...meta,
  });
}
