import { jsonResponse } from "../_shared/auth.js";
import { verifyCronSecret } from "../_shared/stats-refresh.js";

/**
 * Cron-only bootstrap — returns RESEND_API_KEY for local cred vault sync.
 * Cloudflare Pages secret values cannot be read via wrangler/API; this endpoint
 * reads the runtime binding after CRON_SECRET auth.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = verifyCronSecret(request, env);
  if (!auth.ok) {
    return jsonResponse(
      { error: auth.reason ?? "unauthorized" },
      auth.reason === "cron_secret_not_configured" ? 503 : 401
    );
  }

  const resendKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!resendKey) {
    return jsonResponse({ ok: false, reason: "resend_not_configured" }, 404);
  }

  return jsonResponse({ ok: true, resendApiKey: resendKey });
}

export async function onRequestPost() {
  return jsonResponse({ error: "Use GET with cron secret" }, 405);
}
