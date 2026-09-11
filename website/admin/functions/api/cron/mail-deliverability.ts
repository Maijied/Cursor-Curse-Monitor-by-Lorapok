import { jsonResponse } from "../_shared/auth.js";
import { runMailDeliverabilityAudit } from "../_shared/mail-deliverability-audit.js";
import { verifyCronSecret } from "../_shared/stats-refresh.js";

/**
 * Cron — verify configured mail addresses and transport readiness (MAIL-16).
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = verifyCronSecret(request, env);
  if (!auth.ok) {
    return jsonResponse(
      { error: auth.reason ?? "unauthorized" },
      auth.reason === "cron_secret_not_configured" ? 503 : 401
    );
  }

  try {
    const status = await runMailDeliverabilityAudit(env);
    return jsonResponse({ ok: true, ...status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mail deliverability audit failed";
    return jsonResponse({ ok: false, error: message }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({ error: "Use POST with cron secret" }, 405);
}
