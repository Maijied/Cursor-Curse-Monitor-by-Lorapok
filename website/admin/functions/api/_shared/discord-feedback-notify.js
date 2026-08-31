import { logSystemEvent } from "./system-log.js";
import { readDiscordConfig } from "./discord-config.js";
import { buildDiscordFeedbackEmbed, getMessageBranding } from "./message-cards-runtime.js";

/**
 * Sends a feedback embed to the configured Discord webhook.
 * @param {Record<string, unknown>} env - The environment configuration.
 * @param {{
 *   summary?: string;
 *   triggeredBy?: string | null;
 *   kind?: string;
 *   source?: string;
 *   version?: string | null;
 *   editor?: string | null;
 *   installId?: string | null;
 *   message?: string;
 * }} [payload] - Optional feedback summary and metadata.
 * @return {Promise<{ok: boolean; status?: number; skipped?: boolean; reason?: string; error?: string}>} The webhook delivery result.
 */
export async function notifyDiscordFeedback(env, payload = {}) {
  const config = await readDiscordConfig(env);
  if (!config.feedbackWebhookUrl) {
    return { ok: false, skipped: true, reason: "no_feedback_webhook" };
  }

  const embed = await buildDiscordFeedbackEmbed(env);
  if (payload.summary) {
    embed.description = String(payload.summary).slice(0, 4000);
  }

  const fields = [];
  if (payload.kind) fields.push({ name: "Kind", value: String(payload.kind), inline: true });
  if (payload.source) fields.push({ name: "Source", value: String(payload.source), inline: true });
  if (payload.version) fields.push({ name: "Version", value: String(payload.version), inline: true });
  if (payload.editor) fields.push({ name: "Editor", value: String(payload.editor).slice(0, 200), inline: false });
  if (payload.installId) fields.push({ name: "Install ID", value: `\`${payload.installId}\``, inline: false });
  if (fields.length) embed.fields = fields;

  const branding = await getMessageBranding(env);
  let res;
  try {
    res = await fetch(config.feedbackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Cursor Curse Monitor",
        avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/logo.png",
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
    message: result.ok ? "Discord feedback notification sent" : `Discord feedback failed: ${result.error}`,
    meta: { kind: "feedback" },
    email: payload.triggeredBy ? String(payload.triggeredBy) : null,
  });

  return result;
}
