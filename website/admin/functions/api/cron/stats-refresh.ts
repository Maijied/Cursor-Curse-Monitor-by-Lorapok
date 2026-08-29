import { jsonResponse } from "../_shared/auth.js";
import { isStatsRefreshDue, readStatsRefreshConfig } from "../_shared/stats-refresh-config.js";
import { runStatsRefresh, verifyCronSecret } from "../_shared/stats-refresh.js";

/**
 * Cron entry — secured via CRON_SECRET (X-Cron-Secret or Bearer).
 * Cloudflare Worker ccm-stats-cron calls this every minute; refresh runs when due.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = verifyCronSecret(request, env);
  if (!auth.ok) {
    return jsonResponse({ error: auth.reason ?? "unauthorized" }, auth.reason === "cron_secret_not_configured" ? 503 : 401);
  }

  const config = await readStatsRefreshConfig(env);
  if (!config.enabled) {
    return jsonResponse({ ok: true, skipped: true, reason: "disabled" });
  }
  if (!isStatsRefreshDue(config)) {
    return jsonResponse({ ok: true, skipped: true, reason: "not_due", intervalMinutes: config.intervalMinutes });
  }

  try {
    const result = await runStatsRefresh(env, { triggeredBy: "cron" });
    return jsonResponse({
      ok: result.ok,
      skipped: result.skipped ?? false,
      reason: result.reason,
      refreshedAt: result.snapshot?.refreshedAt ?? null,
      durationMs: result.durationMs ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed";
    const next = {
      ...config,
      lastRunAt: new Date().toISOString(),
      lastRunOk: false,
      lastError: message,
      lastTriggeredBy: "cron",
    };
    if (env.ADMIN_KV?.put) {
      await env.ADMIN_KV.put("integrations:stats-refresh", JSON.stringify(next));
    }
    return jsonResponse({ ok: false, error: message }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({ error: "Use POST with cron secret" }, 405);
}
