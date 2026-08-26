import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { notifyDiscordDeployment } from "../../_shared/discord-notify.js";

/**
 * Handles deployment-completion notifications for the Discord integration.
 *
 * @param context - The request context containing the incoming request and environment bindings.
 * @returns A response indicating authorization, JSON parsing, notification, or delivery status.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const result = await notifyDiscordDeployment(env, {
    phase: "completed",
    actionType: body.actionType ?? "deployment",
    tag: body.tag ?? null,
    channel: body.channel ?? null,
    market: body.market ?? null,
    conclusion: body.conclusion ?? "success",
    runUrl: body.runUrl ?? null,
    triggeredBy: auth.email,
    jobs: Array.isArray(body.jobs) ? body.jobs : [],
  });

  if (result.skipped) {
    return jsonResponse({ ok: true, skipped: true });
  }
  if (!result.ok) {
    return jsonResponse({ error: result.error ?? "Discord notification failed" }, 502);
  }

  return jsonResponse({ ok: true });
}
