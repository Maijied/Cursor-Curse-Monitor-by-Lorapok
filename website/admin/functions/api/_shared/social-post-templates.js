import { buildSocialGalleryCaption } from "./social-gallery-queue.js";
import { truncateDiscordText } from "./discord-deploy-context.js";

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
