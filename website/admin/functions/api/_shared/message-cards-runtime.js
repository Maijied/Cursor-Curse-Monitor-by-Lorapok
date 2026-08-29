import embedded from "./product-context.embedded.json" with { type: "json" };
import { hydrateTemplateValue } from "./product-context-runtime.js";

/** @returns {Record<string, unknown>} */
export function getMessageCatalog() {
  return embedded.messageCatalog ?? {
    branding: {
      mainLogoUrl: embedded.ctx?.mainLogoUrl ?? "https://cursor.lorapok.tech/assets/icon.png",
      discordAvatarUrl: embedded.ctx?.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/icon.png",
      discordAuthorName: "Lorapok Mission Control",
      discordFooterText: "cursor.lorapok.tech · Mission Control",
    },
    footers: {
      email: {
        feedbackCta: "Send feedback",
        helpCta: "Get help",
        collaborateCta: "Join discussions",
      },
      discord: {
        feedbackBlock: `💬 **Feedback** — [GitHub Issues](${embedded.ctx?.feedbackUrl ?? "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues"})`,
        productBlock: "",
        deploySuccessHint: "Share feedback in GitHub Issues if anything looks off after this deploy.",
      },
      notice: { feedbackLabel: "Send feedback" },
    },
    cards: [],
  };
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getHydratedMessageCatalog(env) {
  return hydrateTemplateValue(getMessageCatalog(), env);
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getMessageBranding(env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  return catalog.branding ?? {};
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function getChannelFooters(env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  return catalog.footers ?? {};
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} [env]
 */
export async function getMessageCard(id, env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  const cards = /** @type {Array<{ id: string }>} */ (catalog.cards ?? []);
  return cards.find((card) => card.id === id) ?? null;
}

/**
 * @param {Record<string, unknown>} [env]
 * @returns {Array<Record<string, unknown>>}
 */
export async function listDiscordCards(env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  const cards = /** @type {Array<{ channels?: { discord?: unknown } }>} */ (catalog.cards ?? []);
  return cards.filter((card) => card.channels?.discord);
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function buildDiscordFeedbackEmbed(env) {
  const footers = await getChannelFooters(env);
  const branding = await getMessageBranding(env);
  const feedbackCard = await getMessageCard("feedback-thanks", env);
  const discordChannel = /** @type {{ title?: string; summary?: string }|undefined} */ (
    feedbackCard?.channels?.discord
  );

  return {
    title: discordChannel?.title ?? "💬 Feedback & support",
    color: 0x4d9fff,
    description: discordChannel?.summary ?? footers.discord?.feedbackBlock ?? "",
    footer: {
      text: branding.discordFooterText ?? "cursor.lorapok.tech · Mission Control",
      icon_url: branding.discordAvatarUrl,
    },
  };
}
