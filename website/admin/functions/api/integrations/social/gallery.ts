import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { listSocialGalleryQueue } from "../../_shared/social-gallery-queue.js";

/**
 * Lists queued and recent deploy social-gallery jobs (SOCIAL-02 intake).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.read");
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const data = await listSocialGalleryQueue(env, Number.isFinite(limit) ? limit : 20);
  return jsonResponse({ ok: true, ...data });
}
