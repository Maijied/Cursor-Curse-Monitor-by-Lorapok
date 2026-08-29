import { jsonResponse, verifyAdminRequest } from "../../../_shared/auth.js";
import { runDiscordDigest } from "../../../_shared/discord-digest.js";

/**
 * Manual Discord download digest (master admin).
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  if (!auth.isMaster) {
    return jsonResponse({ error: "Master admin only" }, 403);
  }

  const result = await runDiscordDigest(env, {
    triggeredBy: auth.email ?? "manual",
    force: true,
  });

  if (result.skipped && result.reason === "no_webhook") {
    return jsonResponse({ ok: false, skipped: true, reason: result.reason, error: result.error }, 409);
  }
  if (!result.ok) {
    return jsonResponse({ error: result.error ?? "Discord digest failed" }, 502);
  }

  return jsonResponse({
    ok: true,
    durationMs: result.durationMs ?? null,
    displayTotal: result.displayTotal ?? null,
    syncStatus: result.syncStatus ?? null,
  });
}
