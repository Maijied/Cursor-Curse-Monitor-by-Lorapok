import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import {
  SOCIAL_TEMPLATE_CARDS,
  listSocialPostPreviews,
} from "../../_shared/social-post-templates.js";
import { readSocialConfig, sanitizeSocialConfigForClient } from "../../_shared/social-config.js";

/**
 * Preview Lorapok social post templates for Settings (SOCIAL-01).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.read");
  if (denied) return denied;

  const url = new URL(request.url);
  const templateId = url.searchParams.get("template");
  const previews = listSocialPostPreviews(templateId ?? undefined);
  if (templateId && previews.length === 0) {
    return jsonResponse({ error: "Unknown template id" }, 404);
  }

  const config = sanitizeSocialConfigForClient(await readSocialConfig(env));
  return jsonResponse({
    ok: true,
    items: SOCIAL_TEMPLATE_CARDS,
    previews,
    config,
  });
}
