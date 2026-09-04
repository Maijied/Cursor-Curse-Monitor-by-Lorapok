import { jsonResponse } from "../_shared/auth.js";
import { getMailTransportStatus } from "../_shared/mail.js";
import { probeAndSyncServiceUsage } from "../_shared/service-usage.js";
import { verifyCronSecret } from "../_shared/stats-refresh.js";

/**
 * Cron — probe mail transports and persist service quota / availability snapshot in ADMIN_KV.
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
    const mail = getMailTransportStatus(env);
    const snapshot = await probeAndSyncServiceUsage(env, {
      resendConfigured: mail.resendConfigured,
      relayBound: mail.relayBound,
      restConfigured: mail.restConfigured,
    });
    return jsonResponse({ ok: true, ...snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Service usage sync failed";
    return jsonResponse({ ok: false, error: message }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({ error: "Use POST with cron secret" }, 405);
}
