import { buildSocialGalleryCaption } from "./social-gallery-queue.js";
import { truncateDiscordText } from "./discord-deploy-context.js";

export const SOCIAL_DIMENSIONS = {
  feed: { width: 1080, height: 1080, label: "Feed (square)" },
  story: { width: 1080, height: 1920, label: "Story / Reels" },
  linkedin: { width: 1200, height: 627, label: "LinkedIn" },
};

export const DEFAULT_SOCIAL_HASHTAGS = "#CursorIDE #VSCode #OpenSource #LorapokLabs";

export const SOCIAL_TEMPLATE_CARDS = [
  {
    id: "deploy-digest",
    label: "Deploy digest",
    description: "Release caption with changelog bullets — same tone as deploy social gallery.",
  },
  {
    id: "community",
    label: "Community announcement",
    description: "Lorapok Labs Family invite and Mission Control highlights.",
  },
  {
    id: "feedback",
    label: "Feedback & support",
    description: "Ask for product feedback with help links.",
  },
];

const PRODUCT_URL = "https://cursor.lorapok.tech";
const DISCORD_INVITE = "https://discord.gg/bp42QAMC6";

/**
 * @param {string} templateId
 * @param {Record<string, unknown>} [context]
 */
export function buildSocialPostText(templateId, context = {}) {
  const version = String(context.version ?? context.tag ?? "1.0.0").replace(/^v/i, "");
  const changelog = String(context.changelog ?? context.summary ?? "");

  switch (templateId) {
    case "deploy-digest":
      return buildSocialGalleryCaption(`v${version}`, changelog || "- Mission Control polish\n- Marketplace sync");
    case "community":
      return truncateDiscordText(
        [
          "⚡ Cursor Curse Monitor · Lorapok Labs",
          "",
          "Join the Lorapok Labs Family on Discord for release notes, extension tips, and Mission Control previews.",
          DISCORD_INVITE,
          "",
          `Product site: ${PRODUCT_URL}`,
          "#CursorIDE #VSCode #OpenSource",
        ].join("\n"),
        500
      );
    case "feedback":
      return truncateDiscordText(
        [
          "💬 How is Cursor Curse Monitor working for you?",
          "",
          "Reply in Discord or email cursor.curse.help@lorapok.tech — your feedback shapes the next release.",
          PRODUCT_URL,
          "#CursorIDE #ProductFeedback",
        ].join("\n"),
        500
      );
    default:
      return truncateDiscordText(`Cursor Curse Monitor · Lorapok Labs\n${PRODUCT_URL}`, 280);
  }
}

/**
 * Build publish text for a gallery item (SOCIAL-03).
 *
 * @param {{ caption?: string | null; hashtags?: string | null; imageUrl?: string | null }} item
 */
export function buildSocialPublishText(item) {
  const parts = [String(item.caption ?? "").trim()];
  const hashtags = String(item.hashtags ?? DEFAULT_SOCIAL_HASHTAGS).trim();
  if (hashtags) parts.push(hashtags);
  if (item.imageUrl) parts.push(String(item.imageUrl).trim());
  return truncateDiscordText(parts.filter(Boolean).join("\n\n"), 500);
}

/**
 * @param {string} [templateId]
 */
export function listSocialPostPreviews(templateId) {
  const cards = templateId
    ? SOCIAL_TEMPLATE_CARDS.filter((card) => card.id === templateId)
    : SOCIAL_TEMPLATE_CARDS;
  return cards.map((card) => ({
    card,
    text: buildSocialPostText(card.id),
  }));
}
