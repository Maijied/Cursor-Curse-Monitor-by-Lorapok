import { readDiscordConfig } from "./discord-config.js";
import { buildDiscordCommunityEmbed } from "./discord-product-cards.js";
import { getMessageBranding } from "./message-cards-runtime.js";

/**
 * Sends a community announcement embed to the configured community webhook.
 * @param {Record<string, unknown>} env - The environment configuration.
 * @param {{
 *   summary?: string;
 *   inviteUrl?: string;
 *   triggeredBy?: string | null;
 * }} [payload] - Optional summary and actor metadata.
 * @return {Promise<{ok: boolean; status?: number; skipped?: boolean; reason?: string; error?: string}>} The webhook delivery result.
 */
export async function notifyDiscordCommunity(env, payload = {}) {
  const config = await readDiscordConfig(env);
  if (!config.communityWebhookUrl) {
    return { ok: false, skipped: true, reason: "no_community_webhook" };
  }

  const embed = await buildDiscordCommunityEmbed(env, {
    summary: payload.summary,
    inviteUrl: payload.inviteUrl ?? config.communityInviteUrl,
    triggeredBy: payload.triggeredBy ?? null,
  });

  const branding = await getMessageBranding(env);
  let res;
  try {
    res = await fetch(config.communityWebhookUrl, {
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
      error: error instanceof Error ? error.message : "Discord community request failed",
    };
  }

  return res.ok
    ? { ok: true, status: res.status }
    : {
        ok: false,
        status: res.status,
        error: (await res.text().catch(() => "")).slice(0, 300) || `Discord returned ${res.status}`,
      };
}
