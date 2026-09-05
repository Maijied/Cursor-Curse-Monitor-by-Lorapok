import { jsonResponse, verifyAdminRequest, requirePermission } from "../../../_shared/auth.js";
import { queueSocialGalleryJob } from "../../../_shared/social-gallery-queue.js";
import { verifyCronSecret } from "../../../_shared/stats-refresh.js";

/**
 * Queue a deploy social-gallery job (admin UI, CI, or cron secret).
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const cron = verifyCronSecret(request, env);
  let triggeredBy = typeof body.triggeredBy === "string" ? body.triggeredBy : "ci";

  if (!cron.ok) {
    const auth = await verifyAdminRequest(request, env);
    if (auth.error) return auth.error;
    const denied = requirePermission(auth, "integrations.write");
    if (denied) return denied;
    triggeredBy = auth.email ?? "admin";
  }

  const result = await queueSocialGalleryJob(env, {
    tag: body.tag ?? null,
    actionType: body.actionType ?? body.action_type ?? null,
    caption: body.caption ?? null,
    runUrl: body.runUrl ?? body.run_url ?? null,
    channel: body.channel ?? null,
    market: body.market ?? null,
    triggeredBy,
    source: body.source ?? (cron.ok ? "ci" : "mission-control"),
  });

  if (!result.ok) {
    return jsonResponse({ error: result.error ?? "Queue failed" }, 503);
  }

  return jsonResponse(result);
}
