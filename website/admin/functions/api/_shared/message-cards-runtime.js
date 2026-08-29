import embedded from "./product-context.embedded.json" with { type: "json" };

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

export function getMessageBranding() {
  return getMessageCatalog().branding ?? {};
}

export function getChannelFooters() {
  return getMessageCatalog().footers ?? {};
}

/**
 * @param {string} id
 */
export function getMessageCard(id) {
  const cards = /** @type {Array<{ id: string }>} */ (getMessageCatalog().cards ?? []);
  return cards.find((card) => card.id === id) ?? null;
}

/**
 * @returns {Array<Record<string, unknown>>}
 */
export function listDiscordCards() {
  const cards = /** @type {Array<{ channels?: { discord?: unknown } }>} */ (
    getMessageCatalog().cards ?? []
  );
  return cards.filter((card) => card.channels?.discord);
}

export function buildDiscordFeedbackEmbed() {
  const footers = getChannelFooters();
  const branding = getMessageBranding();
  const feedbackCard = getMessageCard("feedback-thanks");
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
