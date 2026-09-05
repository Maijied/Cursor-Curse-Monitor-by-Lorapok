import { logSystemEvent } from "./system-log.js";
import { readDiscordConfig } from "./discord-config.js";
import { buildDeployEnrichment, truncateDiscordText } from "./discord-deploy-context.js";
import {
  getMessageBranding,
  getMessageCatalog,
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
  "auto-rollback": "Auto-rollback",
  "deploy-infra": "Infra deploy",
  "deployment-status-test": "Deployment status test",
  "download-digest": "Download digest",
};

const TRIGGERED_BY_LABELS = {
  "auto-rollback": "Auto-rollback",
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
 * @param {unknown} triggeredBy
 */
function formatTriggeredBy(triggeredBy) {
  if (!triggeredBy) return null;
  const raw = String(triggeredBy).trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (TRIGGERED_BY_LABELS[key]) return TRIGGERED_BY_LABELS[key];
  if (key.includes("@")) return raw;
  return raw;
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
  const catalogBrand =
    enrichment?.catalogBrand ?? getMessageCatalog().branding ?? {};
  const brand = enrichment?.brand ?? {};
  const avatarUrl =
    brand.icon ?? catalogBrand.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/logo.png";
  const authorName = catalogBrand.discordAuthorName ?? "Lorapok Mission Control";
  const footerText = catalogBrand.discordFooterText ?? "cursor.lorapok.tech · Mission Control";

  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [{ name: "Action", value: actionLabel, inline: true }];

  const version = payload.tag ?? payload.version;
  if (version) fields.push({ name: "Version", value: `\`${version}\``, inline: true });
  if (payload.channel) fields.push({ name: "Channel", value: String(payload.channel), inline: true });
  if (payload.market) fields.push({ name: "Marketplaces", value: String(payload.market), inline: true });
  if (payload.triggeredBy) {
    const actor = formatTriggeredBy(payload.triggeredBy);
    if (actor) fields.push({ name: "Triggered by", value: actor, inline: true });
  }
  if (payload.duration) fields.push({ name: "Duration", value: String(payload.duration), inline: true });

  const descriptionParts = [status.brandLine];
  if (payload.summary) descriptionParts.push(String(payload.summary));
  if (status.color === COLORS.success) {
    const footers = enrichment?.catalogFooters ?? getMessageCatalog().footers ?? {};
    const hint = footers.discord?.deploySuccessHint;
    if (hint) descriptionParts.push(hint);
  }

  appendEnrichmentSections(descriptionParts, payload, enrichment);

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

  return embed;
}

/**
 * @param {Array<{ name: string; value: string }>} fields
 * @param {string} name
 * @returns {string}
 */
function pickFieldValue(fields, name) {
  return fields.find((field) => field.name === name)?.value ?? "—";
}

/**
 * Compact marketplace sync summary for a single embed field.
 * @param {Record<string, unknown>|null|undefined} enrichment
 * @returns {string|null}
 */
export function buildCompactMarketplaceSummary(enrichment) {
  const marketplaceFields = enrichment?.marketplaceFields;
  if (!Array.isArray(marketplaceFields) || marketplaceFields.length === 0) return null;

  const lines = [
    `Package ${pickFieldValue(marketplaceFields, "Package")} · GitHub ${pickFieldValue(marketplaceFields, "GitHub release")} · Sync ${pickFieldValue(marketplaceFields, "Sync status")}`,
    `Open VSX ${pickFieldValue(marketplaceFields, "Open VSX")} · Duplicate ${pickFieldValue(marketplaceFields, "Open VSX duplicate")} · VSCE ${pickFieldValue(marketplaceFields, "VS Code Marketplace")}`,
    `Firefox ${pickFieldValue(marketplaceFields, "Firefox AMO")} · Release ${pickFieldValue(marketplaceFields, "Release status")} · Published ${pickFieldValue(marketplaceFields, "Published version")}`,
  ];

  return truncateDiscordText(lines.join("\n"), 1024);
}

/**
 * @param {Record<string, unknown>|null|undefined} enrichment
 * @returns {string|null}
 */
export function buildCompactStatsBlock(enrichment) {
  if (!enrichment) return null;

  const parts = [];
  if (enrichment.downloadBreakdown) {
    parts.push(String(enrichment.downloadBreakdown).replace(/^```\n?|\n?```$/g, "").trim());
  }
  if (enrichment.engagement) {
    parts.push(String(enrichment.engagement).replace(/^```\n?|\n?```$/g, "").trim());
  }
  if (!parts.length) return null;

  return truncateDiscordText(`\`\`\`\n${parts.join("\n\n")}\n\`\`\``, 1024);
}

/**
 * Appends pipeline and enrichment sections to the embed description (one Discord card body).
 * @param {string[]} sections
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} enrichment
 */
export function appendEnrichmentSections(sections, payload, enrichment) {
  if (Array.isArray(payload.jobs) && payload.jobs.length > 0) {
    const lines = payload.jobs
      .map((job) => {
        const name = job.name ?? "Job";
        const state = job.conclusion ?? job.status ?? "unknown";
        return `${jobIcon(job)} **${name}** — ${state}`;
      })
      .join("\n");
    sections.push(`**Pipeline**\n${lines.slice(0, 1800)}`);
  }

  if (!enrichment || payload.phase === "started") return;

  const marketplace = buildCompactMarketplaceSummary(enrichment);
  if (marketplace) sections.push(`**Release sync**\n${marketplace}`);

  const stats = buildCompactStatsBlock(enrichment);
  if (stats) sections.push(`**Reach & engagement**\n${stats}`);

  if (enrichment.changelog && payload.conclusion !== "cancelled") {
    sections.push(`**What's new**\n${truncateDiscordText(String(enrichment.changelog), 1200)}`);
  }

  if (enrichment.quickLinks) {
    sections.push(`**Links**\n${truncateDiscordText(String(enrichment.quickLinks), 900)}`);
  }
}

/**
 * @deprecated Use {@link appendEnrichmentSections} — enrichment lives in the embed description now.
 */
export function appendEnrichmentFields(fields, payload, enrichment) {
  const sections = [];
  appendEnrichmentSections(sections, payload, enrichment);
  for (const section of sections) {
    const [heading, ...rest] = section.split("\n");
    const name = heading.replace(/^\*\*|\*\*$/g, "");
    fields.push({ name, value: rest.join("\n").slice(0, 1024), inline: false });
  }
}

/**
 * Build supplemental Discord embeds from available deployment enrichment data.
 * @deprecated Consolidated into {@link buildDeploymentEmbed}; kept for compatibility.
 * @param {Record<string, unknown>} payload - Deployment data used to determine embed status.
 * @param {Record<string, unknown>|null|undefined} enrichment - Optional marketplace, download, engagement, changelog, and link data.
 * @returns {Array<Record<string, unknown>>} Always empty — enrichment is merged into the primary embed.
 */
export function buildSupplementalEmbeds(payload, enrichment) {
  void payload;
  void enrichment;
  return [];
}

/**
 * Build all Discord embeds for a deployment notification.
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} [enrichment]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildDeploymentEmbeds(payload, enrichment) {
  return [buildDeploymentEmbed(payload, enrichment)];
}

/**
 * Delivers a deployment notification to a Discord webhook.
 * @param {string} webhookUrl - The Discord webhook URL.
 * @param {Record<string, unknown>} payload - Deployment data used to build the notification embeds.
 * @param {Record<string, unknown>|null|undefined} [enrichment] - Optional live product context used for notification content and branding.
 * @param {*} [env] - Optional runtime environment used to resolve branding.
 * @return {{ok: boolean, status: number, error?: string}} The delivery result, including a truncated error message when the request fails.
 */
export async function sendDiscordWebhook(webhookUrl, payload, enrichment, env) {
  const embeds = buildDeploymentEmbeds(payload, enrichment);
  const branding =
    enrichment?.catalogBrand ??
    (env ? await getMessageBranding(env) : getMessageCatalog().branding ?? {});
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Mission Control",
      avatar_url: branding.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/logo.png",
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
  const webhookUrl = config.deploymentWebhookUrl;
  if (!webhookUrl) {
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

  const result = await sendDiscordWebhook(webhookUrl, payload, enrichment, env);

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
