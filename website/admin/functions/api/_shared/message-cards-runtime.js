import embedded from "./product-context.embedded.json" with { type: "json" };
import { hydrateTemplateValue } from "./product-context-runtime.js";

/**
 * Provides the embedded message catalog or a default catalog with branding, footers, and no cards.
 * @returns {Record<string, unknown>} The message catalog.
 */
export function getMessageCatalog() {
  return embedded.messageCatalog ?? {
    branding: {
      mainLogoUrl: embedded.ctx?.mainLogoUrl ?? "https://cursor.lorapok.tech/assets/logo.png",
      discordAvatarUrl: embedded.ctx?.discordAvatarUrl ?? "https://cursor.lorapok.tech/assets/logo.png",
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
 * Hydrate the message catalog with environment-specific values.
 * @param {Record<string, unknown>} [env] - Environment values used during hydration.
 * @return {Record<string, unknown>} The hydrated message catalog.
 */
export async function getHydratedMessageCatalog(env) {
  return hydrateTemplateValue(getMessageCatalog(), env);
}

/**
 * Retrieves the message branding configuration.
 * @param {Record<string, unknown>} [env] - Environment values used to hydrate branding templates.
 * @return {Record<string, unknown>} The branding configuration, or an empty object when unavailable.
 */
export async function getMessageBranding(env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  return catalog.branding ?? {};
}

/**
 * Retrieves channel footer messages, optionally hydrated with environment values.
 * @param {Record<string, unknown>} [env] - Environment values used to hydrate footer templates.
 * @return {Record<string, unknown>} The channel footer messages.
 */
export async function getChannelFooters(env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  return catalog.footers ?? {};
}

/**
 * Finds a message card by its identifier.
 * @param {string} id - The message card identifier.
 * @return {object|null} The matching message card, or `null` if no card matches.
 */
export async function getMessageCard(id, env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  const cards = /** @type {Array<{ id: string }>} */ (catalog.cards ?? []);
  return cards.find((card) => card.id === id) ?? null;
}

/**
 * Lists message cards configured for Discord delivery.
 * @param {Record<string, unknown>} [env] - Environment values used to hydrate the message catalog.
 * @returns {Array<Record<string, unknown>>} Message cards containing a Discord channel configuration.
 */
export async function listDiscordCards(env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  const cards = /** @type {Array<{ channels?: { discord?: unknown } }>} */ (catalog.cards ?? []);
  return cards.filter((card) => card.channels?.discord);
}

/**
 * Builds the Discord embed used for feedback and support messages.
 * @param {Record<string, unknown>} [env] - Environment values used to hydrate message content.
 * @return {{title: string, color: number, description: string, footer: {text: string, icon_url?: string}}} The Discord embed configuration.
 */
export async function buildDiscordFeedbackEmbed(env) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  const footers = catalog.footers ?? {};
  const branding = catalog.branding ?? {};
  const cards = /** @type {Array<{ id: string; channels?: { discord?: { title?: string; summary?: string } } }>} */ (
    catalog.cards ?? []
  );
  const feedbackCard = cards.find((card) => card.id === "feedback-thanks") ?? null;
  const discordChannel = feedbackCard?.channels?.discord;

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
