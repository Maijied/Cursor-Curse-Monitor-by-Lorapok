import { readDiscordConfig } from "./discord-config.js";
import { getMessageBranding } from "./message-cards-runtime.js";
import { truncateDiscordText } from "./discord-deploy-context.js";
import { logSystemEvent } from "./system-log.js";
import { readSocialConfig, SOCIAL_PLATFORMS, validateSocialPlatform } from "./social-config.js";
import { sendSocialPost } from "./social-notify.js";

const COLORS = {
  push: 0x5865f2,
  release: 0x57f287,
  workflow_success: 0x57f287,
  workflow_failure: 0xed4245,
  workflow_other: 0xfee75c,
  default: 0x4d9fff,
};

const REPO_URL = "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok";

/**
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export function buildGithubWebhookSocialText(input) {
  const event = String(input.event ?? "");
  const summary = String(input.summary ?? "GitHub event");
  const repo = String(input.payload?.repository?.full_name ?? "Maijied/Cursor-Curse-Monitor-by-Lorapok");
  const lines = [`⚡ ${repo}`, "", summary];

  if (event === "release" && input.payload?.release?.html_url) {
    lines.push(String(input.payload.release.html_url));
  } else {
    lines.push(REPO_URL);
  }

  lines.push("#CursorIDE #OpenSource #LorapokLabs");
  return truncateDiscordText(lines.join("\n"), 500);
}

/**
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export function buildGithubWebhookDiscordEmbed(input) {
  const event = String(input.event ?? "unknown");
  const summary = String(input.summary ?? "GitHub event");
  const repo = String(input.payload?.repository?.full_name ?? "repository");
  const url =
    input.payload?.release?.html_url ??
    input.payload?.workflow_run?.html_url ??
    input.payload?.compare ??
    REPO_URL;

  let title = "📡 GitHub webhook";
  let color = COLORS.default;

  if (event === "push") {
    title = "🔀 GitHub push";
    color = COLORS.push;
  } else if (event === "release") {
    title = "🏷️ GitHub release";
    color = COLORS.release;
  } else if (event === "workflow_run") {
    const conclusion = String(
      input.payload?.workflow_run?.conclusion ?? input.payload?.workflow_run?.status ?? ""
    );
    if (conclusion === "success") {
      title = "✅ GitHub workflow succeeded";
      color = COLORS.workflow_success;
    } else if (conclusion === "failure") {
      title = "❌ GitHub workflow failed";
      color = COLORS.workflow_failure;
    } else {
      title = "⚙️ GitHub workflow";
      color = COLORS.workflow_other;
    }
  }

  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [
    { name: "Repository", value: repo, inline: true },
    { name: "Event", value: event, inline: true },
    { name: "Summary", value: truncateDiscordText(summary, 200), inline: false },
  ];

  return {
    title,
    color,
    url: String(url),
    fields,
    footer: { text: "GitHub webhook · Mission Control" },
    timestamp: new Date().toISOString(),
  };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export async function notifyDiscordGithubWebhook(env, input) {
  const config = await readDiscordConfig(env);
  const webhookUrl = config.communityWebhookUrl || config.deploymentWebhookUrl;
  if (!webhookUrl) {
    return { ok: false, skipped: true, reason: "no_discord_webhook" };
  }

  const embed = buildGithubWebhookDiscordEmbed(input);
  const branding = await getMessageBranding(env);

  let res;
  try {
    res = await fetch(webhookUrl, {
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
      error: error instanceof Error ? error.message : "Discord request failed",
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 300) || `Discord returned ${res.status}`,
    };
  }

  return { ok: true, status: res.status, target: config.communityWebhookUrl ? "community" : "deployment" };
}

/**
 * Social fan-out: release events only (avoid spam on every push/workflow).
 *
 * @param {Record<string, unknown>} env
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export async function fanOutGithubWebhookSocial(env, input) {
  if (String(input.event ?? "") !== "release") {
    return { ok: true, skipped: true, reason: "social_release_only", results: [] };
  }

  const config = await readSocialConfig(env);
  const text = buildGithubWebhookSocialText(input);
  const results = [];

  for (const platform of SOCIAL_PLATFORMS) {
    const platformConfig = config[platform] ?? {};
    const validation = validateSocialPlatform(platform, platformConfig);
    if (!validation.ok || !validation.enabled) {
      results.push({
        ok: false,
        platform,
        skipped: true,
        error: validation.enabled === false ? "Disabled" : validation.error ?? "Not configured",
      });
      continue;
    }
    results.push(await sendSocialPost(platform, platformConfig, text));
  }

  const failed = results.filter((r) => !r.ok && !r.skipped).length;
  return { ok: failed === 0, results };
}

/**
 * Fan out GitHub webhook ingest to Discord + social (best-effort).
 *
 * @param {Record<string, unknown>} env
 * @param {{ event: string; payload: Record<string, unknown>; summary: string }} input
 */
export async function fanOutGithubWebhook(env, input) {
  const discord = await notifyDiscordGithubWebhook(env, input);
  const social = await fanOutGithubWebhookSocial(env, input);

  const level = discord.ok || discord.skipped ? (social.ok || social.skipped ? "info" : "warn") : "error";
  await logSystemEvent(env, {
    level,
    source: "github-webhook-fanout",
    message: `GitHub ${input.event} fan-out: discord=${discord.ok ? "ok" : discord.skipped ? "skip" : "fail"} social=${social.skipped ? "skip" : social.ok ? "ok" : "partial"}`,
    meta: {
      event: input.event,
      discord,
      socialSummary: social.results?.length ?? 0,
    },
  });

  return { discord, social };
}
