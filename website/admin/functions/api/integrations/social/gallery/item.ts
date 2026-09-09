import { jsonResponse, verifyAdminRequest, requirePermission } from "../../../_shared/auth.js";
import { updateSocialGalleryItem } from "../../../_shared/social-gallery-queue.js";

/**
 * Update caption/hashtags on a deploy social-gallery item.
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const id = String(body.id ?? "").trim();
  if (!id) return jsonResponse({ error: "id is required" }, 400);

  const patch = {};
  if (typeof body.caption === "string") patch.caption = body.caption.trim();
  if (typeof body.hashtags === "string") patch.hashtags = body.hashtags.trim();

  if (!Object.keys(patch).length) {
    return jsonResponse({ error: "caption or hashtags required" }, 400);
  }

  try {
    const item = await updateSocialGalleryItem(env, id, patch);
    if (!item) return jsonResponse({ error: "Gallery item not found" }, 404);
    return jsonResponse({ ok: true, item });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Update failed" },
      503
    );
  }
}
