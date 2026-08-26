import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { notifyDiscordDeployment } from "../../_shared/discord-notify.js";

function verifyCallbackSecret(request, env) {
  const secret = env.DEPLOY_NOTIFY_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("Authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  const callbackOk = verifyCallbackSecret(request, env);
  let triggeredBy = "GitHub Actions";

  if (!callbackOk) {
    const auth = await verifyAdminRequest(request, env);
    if (auth.error) return auth.error;
    triggeredBy = auth.email ?? "Mission Control";
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const payload = {
    phase: "completed",
    actionType: body.actionType ?? body.action_type ?? "deployment",
    tag: body.tag ?? body.target_tag ?? body.version ?? null,
    version: body.version ?? null,
    channel: body.channel ?? body.release_channel ?? null,
    market: body.market ?? body.publish_market ?? null,
    conclusion: body.conclusion ?? "success",
    runUrl: body.runUrl ?? body.run_url ?? null,
    branch: body.branch ?? "main",
    triggeredBy: body.triggeredBy ?? body.triggered_by ?? triggeredBy,
    summary: body.summary ?? null,
    duration: body.duration ?? null,
    startedAt: body.startedAt ?? body.started_at ?? null,
    completedAt: body.completedAt ?? body.completed_at ?? null,
    jobs: Array.isArray(body.jobs) ? body.jobs : [],
  };

  const work = notifyDiscordDeployment(env, payload);

  if (typeof waitUntil === "function") {
    waitUntil(work);
  } else {
    const result = await work;
    if (!result.ok && !result.skipped) {
      return jsonResponse({ error: result.error ?? "Discord notification failed" }, 502);
    }
    if (result.skipped) {
      return jsonResponse({ ok: true, skipped: true, reason: result.reason });
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: true, queued: true });
}
