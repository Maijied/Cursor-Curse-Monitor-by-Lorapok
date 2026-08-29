import { logSystemEvent } from "./system-log.js";
import { readDiscordConfig } from "./discord-config.js";
import { buildDeployEnrichment, truncateDiscordText } from "./discord-deploy-context.js";
import {
  buildDiscordFeedbackEmbed,
  getChannelFooters,
  getMessageBranding,
} from "./message-cards-runtime.js";

const COLORS = {
  started: 0x5865f2,
  success: 0x57f287,
  failure: 0xed4245,
  cancelled: 0xfee75c,
  info: 0x4d9fff,
};

const ACTION_LABELS = {
  "full-release": "Full release",
  "publish-tag": "Publish tag",
  rollback: "Rollback",
  "deploy-infra": "Infra deploy",
  "deployment-status-test": "Deployment status test",
};

/**
 * Formats a deployment action identifier as a human-readable label.
 * @param {*} actionType - The action identifier or descriptive action string.
 * @returns {string} The matching display label, the leading action text, or `"Deployment"` when no action is provided.
 */
function formatActionType(actionType) {
  if (!actionType) return "Deployment";
  const raw = String(actionType);
  const key = raw.split(" - ")[0]?.trim().toLowerCase() ?? raw.toLowerCase();
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  if (raw.includes("full-release")) return ACTION_LABELS["full-release"];
  if (raw.includes("publish-tag")) return ACTION_LABELS["publish-tag"];
  if (raw.includes("rollback")) return ACTION_LABELS.rollback;
  if (raw.includes("deploy-infra")) return ACTION_LABELS["deploy-infra"];
  if (raw.includes("deployment-status-test")) return ACTION_LABELS["deployment-status-test"];
  return raw.split(" - ")[0] ?? raw;
}

/**
 * Selects an emoji representing a job's conclusion or current status.
 * @param {Object} job - The job whose outcome determines the emoji.
 * @returns {string} The emoji for success, skipped, cancelled, failure, or an in-progress state.
 */
function jobIcon(job) {
  const conclusion = job.conclusion ?? job.status;
  if (conclusion === "success") return "✅";
  if (conclusion === "skipped") return "⏭️";
  if (conclusion === "cancelled") return "⏹️";
  if (conclusion === "failure") return "❌";
  return "⏳";
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {{ title: string; color: number; brandLine: string }}
 */
function resolveStatus(payload) {
  const phase = String(payload.phase ?? "completed");
  const conclusion = payload.conclusion ? String(payload.conclusion) : null;
  const version = payload.tag ?? payload.version;
  const brandLine = version
    ? `⚡ **Cursor Curse Monitor** · \`${version}\` · Lorapok Labs`
    : "⚡ **Cursor Curse Monitor** · Lorapok Labs";

  if (phase === "started") {
    return { title: "🚀 Deployment started", color: COLORS.started, brandLine };
  }
  if (conclusion === "success") {
    return { title: "✅ Deployment succeeded", color: COLORS.success, brandLine };
  }
  if (conclusion === "cancelled") {
    return { title: "⏹️ Deployment cancelled", color: COLORS.cancelled, brandLine };
  }
  if (conclusion === "failure") {
    return { title: "❌ Deployment failed", color: COLORS.failure, brandLine };
  }
  return { title: "📡 Deployment update", color: COLORS.info, brandLine };
}

/**
 * Build the primary Discord embed describing deployment status.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} enrichment
 * @returns {Record<string, unknown>}
 */
export function buildDeploymentEmbed(payload, enrichment) {
  const status = resolveStatus(payload);
  const actionLabel = formatActionType(payload.actionType);
  const catalogBrand = getMessageBranding();
  const brand = enrichment?.brand ?? {};
  const avatarUrl =
    brand.icon ?? catalogBrand.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/icon.png";
  const authorName = catalogBrand.discordAuthorName ?? "Lorapok Mission Control";
  const footerText = catalogBrand.discordFooterText ?? "cursor.lorapok.tech · Mission Control";

  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [{ name: "Action", value: actionLabel, inline: true }];

  const version = payload.tag ?? payload.version;
  if (version) fields.push({ name: "Version", value: `\`${version}\``, inline: true });
  if (payload.channel) fields.push({ name: "Channel", value: String(payload.channel), inline: true });
  if (payload.market) fields.push({ name: "Marketplaces", value: String(payload.market), inline: true });
  if (payload.triggeredBy) fields.push({ name: "Triggered by", value: String(payload.triggeredBy), inline: true });
  if (payload.duration) fields.push({ name: "Duration", value: String(payload.duration), inline: true });

  if (Array.isArray(payload.jobs) && payload.jobs.length > 0) {
    const lines = payload.jobs
      .map((job) => {
        const name = job.name ?? "Job";
        const state = job.conclusion ?? job.status ?? "unknown";
        return `${jobIcon(job)} **${name}** — ${state}`;
      })
      .join("\n");
    fields.push({ name: "Pipeline", value: lines.slice(0, 1024), inline: false });
  }

  const descriptionParts = [status.brandLine];
  if (payload.summary) descriptionParts.push(String(payload.summary));
  if (status.color === COLORS.success) {
    const hint = getChannelFooters().discord?.deploySuccessHint;
    if (hint) descriptionParts.push(hint);
  }

  /** @type {Record<string, unknown>} */
  const embed = {
    author: {
      name: authorName,
      icon_url: avatarUrl,
    },
    title: status.title,
    color: status.color,
    description: truncateDiscordText(descriptionParts.join("\n\n"), 4096),
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: footerText,
      icon_url: avatarUrl,
    },
  };

  if (payload.runUrl) embed.url = String(payload.runUrl);
  embed.thumbnail = { url: avatarUrl };
  if (status.color === COLORS.success && brand?.banner) {
    embed.image = { url: brand.banner };
  }

  return embed;
}

/**
 * Build supplemental embeds with marketplace sync, downloads, changelog, and links.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} enrichment
 * @returns {Array<Record<string, unknown>>}
 */
export function buildSupplementalEmbeds(payload, enrichment) {
  if (!enrichment) return [];

  const status = resolveStatus(payload);
  const embeds = [];

  if (enrichment.marketplaceFields?.length) {
    embeds.push({
      title: "📦 Marketplace & release records",
      color: COLORS.info,
      fields: enrichment.marketplaceFields,
    });
  }

  if (enrichment.downloadBreakdown) {
    embeds.push({
      title: "📊 Download breakdown",
      color: COLORS.info,
      description: enrichment.downloadBreakdown,
    });
  }

  if (enrichment.engagement) {
    embeds.push({
      title: "🌐 Website engagement",
      color: COLORS.info,
      description: enrichment.engagement,
    });
  }

  if (enrichment.changelog) {
    embeds.push({
      title: "📝 Changelog",
      color: status.color,
      description: truncateDiscordText(enrichment.changelog, 4096),
    });
  }

  if (enrichment.quickLinks) {
    embeds.push({
      title: "🔗 Quick links",
      color: COLORS.info,
      description: enrichment.quickLinks,
    });
  }

  const footers = getChannelFooters();
  if (footers.discord?.feedbackBlock) {
    embeds.push(buildDiscordFeedbackEmbed());
  }

  return embeds.slice(0, 9);
}

/**
 * Build all Discord embeds for a deployment notification.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} [enrichment]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildDeploymentEmbeds(payload, enrichment) {
  return [buildDeploymentEmbed(payload, enrichment), ...buildSupplementalEmbeds(payload, enrichment)].slice(
    0,
    10
  );
}

/**
 * Sends a deployment notification to a Discord webhook.
 * @param {string} webhookUrl - The Discord webhook URL.
 * @param {Record<string, unknown>} payload - Deployment data used to build the notification embed.
 * @param {Record<string, unknown>|null|undefined} [enrichment] - Optional live product context.
 * @return {{ok: boolean, status: number, error?: string}} The delivery status and, when applicable, a truncated error message.
 */
export async function sendDiscordWebhook(webhookUrl, payload, enrichment) {
  const embeds = buildDeploymentEmbeds(payload, enrichment);
  const branding = getMessageBranding();
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Mission Control",
      avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/icon.png",
      embeds,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 300) || `Discord webhook returned ${res.status}`,
    };
  }

  return { ok: true, status: res.status };
}

/**
 * Sends a deployment notification to the configured Discord webhook and records the outcome.
 * @param {Record<string, unknown>} payload - Deployment details used to build the notification.
 * @return {Promise<{ok: boolean, skipped?: boolean, reason?: string, status?: number, error?: string}>} The notification result, including skip or failure details when applicable.
 */
export async function notifyDiscordDeployment(env, payload) {
  const config = await readDiscordConfig(env);
  if (!config.webhookUrl) {
    return { ok: false, skipped: true, reason: "no_webhook" };
  }

  let enrichment = null;
  try {
    enrichment = await buildDeployEnrichment(env, {
      tag: payload.tag ?? payload.version ?? null,
      includeChangelog: payload.phase !== "started" && payload.conclusion !== "cancelled",
    });
  } catch (error) {
    console.warn("Discord deploy enrichment failed", error);
  }

  const result = await sendDiscordWebhook(config.webhookUrl, payload, enrichment);

  await logSystemEvent(env, {
    source: "discord",
    level: result.ok ? "info" : "error",
    message: result.ok
      ? `Discord ${payload.phase ?? "deployment"} notification sent`
      : `Discord notification failed: ${result.error}`,
    meta: { phase: payload.phase, actionType: payload.actionType, conclusion: payload.conclusion ?? null },
    email: payload.triggeredBy ? String(payload.triggeredBy) : null,
  });

  return result;
}
