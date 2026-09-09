import { jsonResponse, verifyAdminRequest, requirePermission } from "../../../_shared/auth.js";
import { processSocialGalleryJob } from "../../../_shared/social-gallery-processor.js";

/**
 * Generate or retry Lorapok gallery asset for one item (SOCIAL-02).
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

  const result = await processSocialGalleryJob(env, id);
  if (!result.ok) {
    return jsonResponse({ error: result.error ?? "Generation failed", item: result.item ?? null }, 502);
  }
  return jsonResponse(result);
}
