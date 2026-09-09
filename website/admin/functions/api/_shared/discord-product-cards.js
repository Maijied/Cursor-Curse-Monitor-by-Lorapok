import { DEFAULT_COMMUNITY_INVITE_URL } from "./discord-config.js";
import {
  formatDiscordCount,
  normalizeTag,
  truncateDiscordText,
} from "./discord-deploy-context.js";
import {
  appendEnrichmentSections,
} from "./discord-notify.js";
import { getHydratedMessageCatalog, getMessageCatalog } from "./message-cards-runtime.js";

const DEFAULT_DISCORD_AVATAR = "https://cursor.lorapok.tech/assets/logo.png";

/** Lorapok Discord card palette (DC-06). */
export const DISCORD_PRODUCT_COLORS = {
  digest: 0x4d9fff,
  community: 0x7c5cff,
  feedback: 0x57f287,
  deploy: 0x5865f2,
};

/**
 * @param {unknown} url
 */
function resolveDiscordAvatarUrl(url) {
  if (typeof url === "string" && /^https?:\/\//i.test(url) && !url.includes("{{")) {
    return url;
  }
  return DEFAULT_DISCORD_AVATAR;
}

/**
 * Shared Lorapok author/footer/thumbnail shell for product Discord cards.
 * @param {Record<string, unknown>} catalogBrand
 */
export function buildDiscordProductShell(catalogBrand = {}) {
  const avatarUrl = resolveDiscordAvatarUrl(catalogBrand.discordAvatarUrl);
  return {
    author: {
      name: String(catalogBrand.discordAuthorName ?? "Lorapok Mission Control"),
      icon_url: avatarUrl,
    },
    footer: {
      text: String(catalogBrand.discordFooterText ?? "cursor.lorapok.tech · Mission Control"),
      icon_url: avatarUrl,
    },
    thumbnail: { url: avatarUrl },
  };
}

/**
 * Branded download digest card — marketplace sync, reach, changelog (DC-06).
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} enrichment
 * @param {Record<string, unknown>} [catalogBrand]
 */
export function buildDiscordDigestEmbed(payload, enrichment, catalogBrand) {
  const brand =
    catalogBrand ?? enrichment?.catalogBrand ?? getMessageCatalog().branding ?? {};
  const shell = buildDiscordProductShell(brand);
  const version = payload.tag ?? payload.version ?? "—";
  const brandLine = version
    ? `⚡ **Cursor Curse Monitor** · \`${normalizeTag(String(version)) || version}\` · Lorapok Labs`
    : "⚡ **Cursor Curse Monitor** · Lorapok Labs";

  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [
    { name: "Cadence", value: "Scheduled digest", inline: true },
    { name: "Action", value: "Download digest", inline: true },
  ];

  if (version && version !== "—") {
    fields.push({ name: "Version", value: `\`${normalizeTag(String(version)) || version}\``, inline: true });
  }

  const syncStatus =
    enrichment?.siteData?.marketplaceSync?.syncStatus ??
    enrichment?.siteData?.syncStatus ??
    null;
  if (syncStatus) {
    fields.push({ name: "Marketplace sync", value: String(syncStatus), inline: true });
  }

  const displayTotal =
    enrichment?.siteData?.downloads?.displayTotal ?? enrichment?.siteData?.downloads?.total ?? null;
  if (displayTotal != null) {
    fields.push({
      name: "Community reach",
      value: `**${formatDiscordCount(displayTotal)}** installs`,
      inline: true,
    });
  }

  if (payload.triggeredBy) {
    fields.push({ name: "Triggered by", value: String(payload.triggeredBy), inline: true });
  }

  const sections = [brandLine];
  if (payload.summary) sections.push(String(payload.summary));
  appendEnrichmentSections(
    sections,
    { ...payload, phase: "completed", conclusion: "success" },
    enrichment
  );

  const cards = /** @type {Array<{ id: string; channels?: { discord?: { title?: string } } }>} */ (
    getMessageCatalog().cards ?? []
  );
  const digestCard = cards.find((card) => card.id === "download-digest");

  return {
    ...shell,
    title: digestCard?.channels?.discord?.title ?? "📊 Download & update digest",
    color: DISCORD_PRODUCT_COLORS.digest,
    description: truncateDiscordText(sections.join("\n\n"), 4096),
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, unknown>|null|undefined} enrichment
 * @param {Record<string, unknown>} [catalogBrand]
 */
export function buildDiscordDigestEmbeds(payload, enrichment, catalogBrand) {
  return [buildDiscordDigestEmbed(payload, enrichment, catalogBrand)];
}

/**
 * Branded community announcement card (DC-06).
 * @param {Record<string, unknown>} [env]
 * @param {{
 *   summary?: string;
 *   inviteUrl?: string;
 *   triggeredBy?: string | null;
 * }} [payload]
 */
export async function buildDiscordCommunityEmbed(env, payload = {}) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  const branding = catalog.branding ?? {};
  const footers = catalog.footers ?? {};
  const cards = /** @type {Array<{ id: string; feedbackUrl?: string; collaborateUrl?: string; channels?: { discord?: { title?: string; summary?: string } } }>} */ (
    catalog.cards ?? []
  );
  const communityCard = cards.find((card) => card.id === "community-announcement") ?? null;
  const discordChannel = communityCard?.channels?.discord;

  const inviteUrl = String(payload.inviteUrl ?? DEFAULT_COMMUNITY_INVITE_URL).trim();
  const summary =
    payload.summary ??
    discordChannel?.summary ??
    "Join the Lorapok Labs Family for beta builds, deploy alerts, and contributor shout-outs.";

  const sections = [
    "⚡ **Cursor Curse Monitor** · Lorapok Labs Family",
    String(summary),
  ];
  if (footers.discord?.productBlock) sections.push(String(footers.discord.productBlock));

  const shell = buildDiscordProductShell(branding);
  const feedbackUrl = communityCard?.feedbackUrl ?? embeddedFeedbackUrl();
  const collaborateUrl = communityCard?.collaborateUrl ?? embeddedCollaborateUrl();

  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [
    { name: "Join Discord", value: inviteUrl, inline: false },
    { name: "Discuss releases", value: collaborateUrl, inline: false },
    { name: "Report issues", value: feedbackUrl, inline: false },
  ];

  if (payload.triggeredBy) {
    fields.push({ name: "Sent by", value: String(payload.triggeredBy), inline: true });
  }

  return {
    ...shell,
    title: discordChannel?.title ?? "👋 Lorapok Labs Family",
    color: DISCORD_PRODUCT_COLORS.community,
    description: truncateDiscordText(sections.join("\n\n"), 4096),
    fields,
    timestamp: new Date().toISOString(),
  };
}

function embeddedFeedbackUrl() {
  return (
    getMessageCatalog().cards?.find((c) => c.id === "feedback-thanks")?.feedbackUrl ??
    "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues"
  );
}

function embeddedCollaborateUrl() {
  return (
    getMessageCatalog().cards?.find((c) => c.id === "feedback-thanks")?.collaborateUrl ??
    "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/discussions"
  );
}

/**
 * Branded feedback & support card with structured links (DC-06).
 * @param {Record<string, unknown>} [env]
 * @param {{
 *   summary?: string;
 *   kind?: string;
 *   source?: string;
 *   version?: string | null;
 *   editor?: string | null;
 *   installId?: string | null;
 *   message?: string;
 *   triggeredBy?: string | null;
 * }} [payload]
 */
export async function buildDiscordFeedbackProductEmbed(env, payload = {}) {
  const catalog = env ? await getHydratedMessageCatalog(env) : getMessageCatalog();
  const branding = catalog.branding ?? {};
  const footers = catalog.footers ?? {};
  const cards = /** @type {Array<{ id: string; feedbackUrl?: string; collaborateUrl?: string; channels?: { discord?: { title?: string; summary?: string } } }>} */ (
    catalog.cards ?? []
  );
  const feedbackCard = cards.find((card) => card.id === "feedback-thanks") ?? null;
  const discordChannel = feedbackCard?.channels?.discord;

  const shell = buildDiscordProductShell(branding);
  const descriptionParts = [
    "⚡ **Cursor Curse Monitor** · Feedback channel",
    payload.summary ?? discordChannel?.summary ?? footers.discord?.feedbackBlock ?? "",
  ];
  if (payload.message) {
    descriptionParts.push(String(payload.message).slice(0, 1200));
  }

  /** @type {Array<{ name: string; value: string; inline?: boolean }>} */
  const fields = [
    { name: "GitHub Issues", value: feedbackCard?.feedbackUrl ?? embeddedFeedbackUrl(), inline: false },
    { name: "Discussions", value: feedbackCard?.collaborateUrl ?? embeddedCollaborateUrl(), inline: false },
  ];

  if (payload.kind) fields.push({ name: "Kind", value: String(payload.kind), inline: true });
  if (payload.source) fields.push({ name: "Source", value: String(payload.source), inline: true });
  if (payload.version) fields.push({ name: "Version", value: String(payload.version), inline: true });
  if (payload.editor) {
    fields.push({ name: "Editor", value: String(payload.editor).slice(0, 200), inline: false });
  }
  if (payload.installId) {
    fields.push({ name: "Install ID", value: `\`${payload.installId}\``, inline: false });
  }
  if (payload.triggeredBy) {
    fields.push({ name: "Operator", value: String(payload.triggeredBy), inline: true });
  }

  return {
    ...shell,
    title: discordChannel?.title ?? "💬 Feedback & support",
    color: DISCORD_PRODUCT_COLORS.feedback,
    description: truncateDiscordText(descriptionParts.filter(Boolean).join("\n\n"), 4096),
    fields,
    timestamp: new Date().toISOString(),
  };
}
