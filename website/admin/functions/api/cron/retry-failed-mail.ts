import { jsonResponse } from "../_shared/auth.js";
import { retryFailedMailboxMessages } from "../_shared/mailbox-retry.js";
import { verifyCronSecret } from "../_shared/stats-refresh.js";

/**
 * Cron/ops entry — resend failed outbound mailbox messages.
 * Secured via CRON_SECRET (X-Cron-Secret or Bearer).
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

  let body = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = await request.json();
    }
  } catch {
    body = {};
  }

  try {
    const result = await retryFailedMailboxMessages(env, {
      sentBy: "cron:retry-failed-mail",
      limit: Math.min(100, Math.max(1, Number.parseInt(String(body.limit ?? "50"), 10) || 50)),
      includeRetried: body.includeRetried === true,
    });
    return jsonResponse({
      ok: result.ok,
      attempted: result.attempted,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
      message:
        result.sent > 0
          ? `Retried ${result.sent} failed message(s).`
          : result.attempted === 0
            ? "No failed outbound messages to retry."
            : "Retry finished with failures — see results.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retry failed";
    return jsonResponse({ ok: false, error: message }, 502);
  }
}

export async function onRequestGet(context) {
  return onRequestPost(context);
}
