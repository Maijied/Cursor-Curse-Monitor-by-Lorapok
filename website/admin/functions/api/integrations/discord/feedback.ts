import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { notifyDiscordFeedback } from "../../_shared/discord-feedback-notify.js";

/** Sends a sample feedback card to the configured feedback webhook (master admin test). */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* optional body */
  }

  const result = await notifyDiscordFeedback(env, {
    summary: body.summary ?? "Sample user-feedback card — GitHub Issues & Discussions links for end users.",
    triggeredBy: auth.email,
  });

  if (result.skipped) {
    return jsonResponse({ ok: true, skipped: true });
  }
  if (!result.ok) {
    return jsonResponse({ error: result.error ?? "Discord feedback notification failed" }, 502);
  }

  return jsonResponse({ ok: true });
}
