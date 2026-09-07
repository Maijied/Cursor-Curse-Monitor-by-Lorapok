import { buildDeployEnrichment } from "./discord-deploy-context.js";
import { buildDeploymentEmbed } from "./discord-notify.js";
import { buildDiscordFeedbackEmbed } from "./message-cards-runtime.js";

/** @typedef {"deployment" | "feedback" | "community"} DiscordWebhookKind */

/**
 * @typedef {Object} DiscordGalleryItem
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {DiscordWebhookKind} webhook
 * @property {string} [configuredKey]
 */

export const DISCORD_GALLERY_ITEMS = [
  {
    id: "deploy-success",
    label: "CI/CD success",
    description: "Jobs, duration, marketplace sync, changelog excerpt, release links.",
    webhook: "deployment",
    configuredKey: "deploymentConfigured",
  },
  {
    id: "deploy-failure",
    label: "CI/CD failure",
    description: "Failed job, Actions logs link, partial changelog, rollback hint.",
    webhook: "deployment",
    configuredKey: "deploymentConfigured",
  },
  {
    id: "download-digest",
    label: "Download digest",
    description: "Scheduled reach & marketplace sync summary (cron).",
    webhook: "deployment",
    configuredKey: "deploymentConfigured",
  },
  {
    id: "feedback",
    label: "Feedback",
    description: "User-facing GitHub Issues & support links.",
    webhook: "feedback",
    configuredKey: "feedbackConfigured",
  },
  {
    id: "community",
    label: "Community",
    description: "Lorapok Labs Family announcement sample.",
    webhook: "community",
    configuredKey: "communityConfigured",
  },
];

const SAMPLE_JOBS = [
  { name: "Build & Validate", conclusion: "success" },
  { name: "Deploy to Marketplaces", conclusion: "success" },
  { name: "Deploy Admin Panel", conclusion: "success" },
];

const SAMPLE_FAILED_JOBS = [
  { name: "Build & Validate", conclusion: "success" },
  { name: "Deploy to Marketplaces", conclusion: "failure" },
  { name: "Deploy Admin Panel", conclusion: "skipped" },
];

/**
 * @param {string} cardId
 * @returns {Record<string, unknown>}
 */
function samplePayloadForCard(cardId) {
  switch (cardId) {
    case "deploy-failure":
      return {
        phase: "completed",
        conclusion: "failure",
        actionType: "publish-tag",
        tag: "v1.0.31",
        channel: "Production",
        market: "Open VSX + Firefox AMO",
        runUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions/runs/1",
        triggeredBy: "preview@lorapok.tech",
        failedStep: "Deploy to Marketplaces / package-extension",
        jobs: SAMPLE_FAILED_JOBS,
        duration: "6m 02s",
        summary: "Marketplace publish failed — inspect the Actions run for the failing step.",
      };
    case "download-digest":
      return {
        phase: "completed",
        conclusion: "success",
        actionType: "download-digest",
        tag: "v1.0.31",
        summary:
          "Scheduled download & product update digest.\nVerified community reach and marketplace sync status.",
        triggeredBy: "cron",
      };
    case "deploy-success":
    default:
      return {
        phase: "completed",
        conclusion: "success",
        actionType: "full-release",
        tag: "v1.0.31",
        channel: "Production",
        market: "Open VSX + Firefox AMO",
        runUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/actions/runs/1",
        triggeredBy: "preview@lorapok.tech",
        jobs: SAMPLE_JOBS,
        duration: "4m 12s",
        summary: "Deployment completed — marketplace sync, downloads, and changelog attached.",
      };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} cardId
 */
export async function buildDiscordGalleryPreview(env, cardId) {
  const item = DISCORD_GALLERY_ITEMS.find((entry) => entry.id === cardId);
  if (!item) return null;

  if (item.id === "feedback") {
    const embed = await buildDiscordFeedbackEmbed(env);
    return { item, embed };
  }

  if (item.id === "community") {
    return {
      item,
      embed: {
        title: "👋 Lorapok Labs Family",
        color: 0x5865f2,
        description:
          "Sample community announcement — product updates, beta invites, and contributor shout-outs.",
        footer: { text: "cursor.lorapok.tech · Lorapok Labs Family" },
      },
    };
  }

  const payload = samplePayloadForCard(item.id);
  let enrichment = null;
  try {
    enrichment = await buildDeployEnrichment(env, {
      tag: payload.tag ?? null,
      includeChangelog: payload.conclusion !== "cancelled",
    });
  } catch (error) {
    console.warn("Discord gallery preview enrichment failed", error);
  }

  const embed = buildDeploymentEmbed(payload, enrichment);
  if (item.id === "download-digest") {
    embed.title = "📊 Download & update digest";
  }

  return { item, embed, payload };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function listDiscordGalleryPreviews(env) {
  const previews = [];
  for (const item of DISCORD_GALLERY_ITEMS) {
    const preview = await buildDiscordGalleryPreview(env, item.id);
    if (preview) previews.push(preview);
  }
  return previews;
}
