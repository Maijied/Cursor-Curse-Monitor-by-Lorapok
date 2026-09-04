import { jsonResponse, verifyAdminRequest, requirePermission } from "../../_shared/auth.js";
import { notifyDiscordFeedback } from "../../_shared/discord-feedback-notify.js";

/** Sends a sample feedback card to the configured feedback webhook (master admin test). */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed === undefined) {
      body = {};
    } else if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    } else {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    /* optional body */
  }

  const summary =
    typeof body.summary === "string"
      ? body.summary
      : "Sample user-feedback card — GitHub Issues & Discussions links for end users.";

  const result = await notifyDiscordFeedback(env, {
    summary,
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
