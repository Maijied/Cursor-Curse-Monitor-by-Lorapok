import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { notifyDiscordCommunity } from "../../_shared/discord-community-notify.js";

/** Sends a sample community post to the configured community webhook (master admin test). */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403);
  }

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
      : "Sample community post — invite users to join and discuss product updates.";

  const result = await notifyDiscordCommunity(env, {
    summary,
    triggeredBy: auth.email,
  });

  if (result.skipped) {
    return jsonResponse({ ok: true, skipped: true });
  }
  if (!result.ok) {
    return jsonResponse({ error: result.error ?? "Discord community notification failed" }, 502);
  }

  return jsonResponse({ ok: true });
}
