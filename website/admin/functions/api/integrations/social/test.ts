import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { SOCIAL_PLATFORMS } from "../../_shared/social-config.js";
import { SOCIAL_TEMPLATE_CARDS } from "../../_shared/social-post-templates.js";
import { runSocialTestFromEnv } from "../../_shared/social-notify.js";

/**
 * Test-send matrix for configured social platforms (SOCIAL-01).
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

  const templateId = String(body.template ?? "deploy-digest").trim();
  const knownTemplate = SOCIAL_TEMPLATE_CARDS.some((card) => card.id === templateId);
  if (!knownTemplate) {
    return jsonResponse({ error: "Unknown template id" }, 400);
  }

  const dryRun = Boolean(body.dryRun);
  const platform = body.platform ? String(body.platform).trim() : "";
  const platforms =
    platform && platform !== "all"
      ? SOCIAL_PLATFORMS.includes(platform)
        ? [platform]
        : null
      : SOCIAL_PLATFORMS;

  if (!platforms) {
    return jsonResponse({ error: "Invalid platform" }, 400);
  }

  const matrix = await runSocialTestFromEnv(env, templateId, {
    platforms,
    dryRun,
    context: body.context && typeof body.context === "object" ? body.context : undefined,
  });

  const sent = matrix.results.filter((entry) => entry.ok).length;
  const skipped = matrix.results.filter((entry) => entry.skipped).length;
  const failed = matrix.results.filter((entry) => !entry.ok && !entry.skipped).length;

  return jsonResponse({
    ok: failed === 0,
    dryRun,
    templateId,
    text: matrix.text,
    summary: { sent, skipped, failed, total: matrix.results.length },
    results: matrix.results,
  });
}
