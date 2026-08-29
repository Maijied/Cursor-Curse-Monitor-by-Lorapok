import { logSystemEvent } from "./system-log.js";
import { readDiscordConfig } from "./discord-config.js";
import { buildDiscordFeedbackEmbed, getMessageBranding } from "./message-cards-runtime.js";

/**
 * Sends a user-feedback style card to the feedback Discord webhook (not deployment status).
 * @param {Record<string, unknown>} env
 * @param {{ summary?: string; triggeredBy?: string | null }} [payload]
 */
export async function notifyDiscordFeedback(env, payload = {}) {
  const config = await readDiscordConfig(env);
  if (!config.feedbackWebhookUrl) {
    return { ok: false, skipped: true, reason: "no_feedback_webhook" };
  }

  const embed = buildDiscordFeedbackEmbed();
  if (payload.summary) {
    embed.description = String(payload.summary);
  }

  const branding = getMessageBranding();
  let res;
  try {
    res = await fetch(config.feedbackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Cursor Curse Monitor",
        avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/icon.png",
        embeds: [embed],
      }),
    });
  } catch (error) {
    const result = {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Discord feedback request failed",
    };
    await logSystemEvent(env, {
      source: "discord",
      level: "error",
      message: `Discord feedback failed: ${result.error}`,
      meta: { kind: "feedback" },
      email: payload.triggeredBy ? String(payload.triggeredBy) : null,
    });
    return result;
  }

  const result = res.ok
    ? { ok: true, status: res.status }
    : {
        ok: false,
        status: res.status,
        error: (await res.text().catch(() => "")).slice(0, 300) || `Discord returned ${res.status}`,
      };

  await logSystemEvent(env, {
    source: "discord",
    level: result.ok ? "info" : "error",
    message: result.ok ? "Discord feedback hook test sent" : `Discord feedback failed: ${result.error}`,
    meta: { kind: "feedback" },
    email: payload.triggeredBy ? String(payload.triggeredBy) : null,
  });

  return result;
}
