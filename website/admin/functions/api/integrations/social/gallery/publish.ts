import { jsonResponse, verifyAdminRequest, requirePermission } from "../../../_shared/auth.js";
import {
  publishSocialGalleryFromEnv,
} from "../../../_shared/social-notify.js";
import {
  readSocialGalleryItem,
  updateSocialGalleryItem,
} from "../../../_shared/social-gallery-queue.js";

/**
 * One-click multi-channel publish for a gallery item (SOCIAL-03).
 */
export async function onRequestPost(context) {
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

  const item = await readSocialGalleryItem(env, id);
  if (!item) return jsonResponse({ error: "Gallery item not found" }, 404);

  const dryRun = body.dryRun === true;
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.map((value) => String(value))
    : undefined;

  const publish = await publishSocialGalleryFromEnv(env, item, { dryRun, platforms });
  if (!publish.ok && !dryRun) {
    return jsonResponse({ error: "One or more channels failed", ...publish }, 502);
  }

  if (!dryRun && publish.summary?.sent > 0) {
    await updateSocialGalleryItem(env, id, {
      publishedAt: new Date().toISOString(),
      publishedPlatforms: publish.results.filter((entry) => entry.ok).map((entry) => entry.platform),
      lastPublishSummary: publish.summary,
    });
  }

  return jsonResponse({ ok: publish.ok, dryRun, ...publish, itemId: id });
}
