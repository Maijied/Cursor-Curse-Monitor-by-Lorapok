import { jsonResponse } from "../_shared/auth.js";
import { isDiscordDigestDue, readDiscordDigestConfig } from "../_shared/discord-digest-config.js";
import { runDiscordDigest } from "../_shared/discord-digest.js";
import { verifyCronSecret } from "../_shared/stats-refresh.js";

/**
 * Cron entry — secured via CRON_SECRET. Worker calls every minute; digest runs when due.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = verifyCronSecret(request, env);
  if (!auth.ok) {
    return jsonResponse({ error: auth.reason ?? "unauthorized" }, auth.reason === "cron_secret_not_configured" ? 503 : 401);
  }

  const config = await readDiscordDigestConfig(env);
  if (!config.enabled) {
    return jsonResponse({ ok: true, skipped: true, reason: "disabled" });
  }
  if (!isDiscordDigestDue(config)) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: "not_due",
      intervalMinutes: config.intervalMinutes,
    });
  }

  try {
    const result = await runDiscordDigest(env, { triggeredBy: "cron" });
    if (result.skipped) {
      return jsonResponse({ ok: true, skipped: true, reason: result.reason, error: result.error ?? null });
    }
    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error ?? "Digest failed" }, 502);
    }
    return jsonResponse({
      ok: true,
      durationMs: result.durationMs ?? null,
      displayTotal: result.displayTotal ?? null,
      syncStatus: result.syncStatus ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Digest failed";
    return jsonResponse({ ok: false, error: message }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({ error: "Use POST with cron secret" }, 405);
}
