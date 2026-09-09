import { readDiscordConfig } from "./discord-config.js";
import { buildDiscordFeedbackProductEmbed } from "./discord-product-cards.js";
import { getMessageBranding } from "./message-cards-runtime.js";

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

  const embed = await buildDiscordFeedbackProductEmbed(env, payload);
  const branding = await getMessageBranding(env);
  let res;
  try {
    res = await fetch(config.feedbackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: branding.discordAuthorName ?? "Lorapok Mission Control",
        avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/logo.png",
        embeds: [embed],
      }),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Discord feedback request failed",
    };
  }

  const result = res.ok
    ? { ok: true, status: res.status }
    : {
        ok: false,
        status: res.status,
        error: (await res.text().catch(() => "")).slice(0, 300) || `Discord returned ${res.status}`,
      };

  return result;
}
