import { GITHUB_REPO } from "./repo-constants.js";
import { githubFetch } from "./github.js";
import { fetchSiteData } from "./site-data.js";
import { fetchLiveChannels } from "./live-channels.js";
import { getChannelFooters, getMessageBranding } from "./message-cards-runtime.js";

const BRAND = {
  site: "https://cursor.lorapok.tech",
  admin: "https://cursor-dev.lorapok.tech",
  repo: `https://github.com/${GITHUB_REPO}`,
  icon: "https://cursor.lorapok.tech/assets/logo.png",
  banner: "https://cursor.lorapok.tech/assets/marketing/og-social-card.png",
  ovsx: "https://open-vsx.org/extension/lorapok-labs/cursor-curse-monitor-by-lorapok",
  vscode:
    "https://marketplace.visualstudio.com/items?itemName=LorapokLabs.cursor-curse-monitor-by-lorapok",
};

/**
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatDiscordCount(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US");
}

/**
 * @param {boolean} synced
 * @returns {string}
 */
export function syncEmoji(synced) {
  return synced ? "✅" : "⚠️";
}

/**
 * @param {string|null|undefined} tag
 * @returns {string}
 */
export function normalizeTag(tag) {
  if (!tag) return "";
  const raw = String(tag).trim();
  return raw.startsWith("v") ? raw : `v${raw}`;
}

/**
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
export function truncateDiscordText(text, maxLen = 900) {
  const value = String(text ?? "").trim();
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

/**
 * @param {string} markdown
 * @param {string|null|undefined} tag
 * @returns {string|null}
 */
export function extractChangelogSection(markdown, tag) {
  if (!markdown || !tag) return null;
  const version = normalizeTag(tag).replace(/^v/i, "");
  const header = new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "im");
  const match = markdown.match(header);
  if (!match || match.index == null) return null;

  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const next = rest.search(/^## \[/m);
  const section = (next === -1 ? rest : rest.slice(0, next)).trim();
  return section || null;
}

/**
 * @param {Record<string, unknown>|null|undefined} siteData
 * @returns {string}
 */
export function formatDownloadBreakdownText(siteData) {
  const downloads = siteData?.downloads;
  if (!downloads?.verified) {
    return "```\nDownloads unavailable — marketplace sources not verified.\n```";
  }

  const breakdown = downloads.breakdown ?? {};
  const lines = [
    "Community reach (verified live)",
    `Total ········· ${formatDiscordCount(downloads.displayTotal ?? downloads.total)}`,
    `Open VSX ········ ${formatDiscordCount(downloads.openVsxCombined)}`,
    `  canonical ····· ${formatDiscordCount(breakdown.openVsxCanonical)}`,
    `  LorapokLabs ··· ${formatDiscordCount(breakdown.openVsxDuplicate)}`,
    `VS Code ········· ${formatDiscordCount(breakdown.vscodeMarketplace)}`,
    `GitHub assets ··· ${formatDiscordCount(breakdown.githubAllAssets)}`,
    `Latest VSIX ····· ${formatDiscordCount(breakdown.latestReleaseVsix)}`,
  ];
  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

/**
 * @param {Record<string, unknown>|null|undefined} siteData
 * @param {Record<string, unknown>|null|undefined} [channels]
 * @returns {Array<{ name: string; value: string; inline?: boolean }>}
 */
export function buildMarketplaceFields(siteData, channels) {
  if (!siteData) {
    return [{ name: "Marketplace", value: "Site data unavailable", inline: false }];
  }

  const pkg = String(siteData.packageVersion ?? siteData.version ?? "—");
  const githubTag = String(siteData.github?.releaseTag ?? "—").replace(/^v/, "");
  const ovsxVersion = String(channels?.ovsxCanonical?.version ?? siteData.ovsx?.version ?? "—");
  const duplicateVersion = String(channels?.ovsxDuplicate?.version ?? siteData.ovsxDuplicate?.version ?? "—");
  const vscodeVersion = String(channels?.vscode?.version ?? siteData.vscode?.version ?? "—");
  const firefoxVersion = String(siteData.browserExtension?.firefox?.version ?? "pending AMO");

  return [
    {
      name: "Package",
      value: `\`${pkg}\` ${syncEmoji(pkg === githubTag)}`,
      inline: true,
    },
    {
      name: "GitHub release",
      value: `\`${siteData.github?.releaseTag ?? "—"}\` ${syncEmoji(githubTag === pkg)}`,
      inline: true,
    },
    {
      name: "Sync status",
      value: String(siteData.syncStatus ?? "unknown"),
      inline: true,
    },
    {
      name: "Open VSX",
      value: `\`${ovsxVersion}\` ${syncEmoji(ovsxVersion === pkg)}`,
      inline: true,
    },
    {
      name: "Open VSX duplicate",
      value: `\`${duplicateVersion}\` ${syncEmoji(duplicateVersion === pkg)}`,
      inline: true,
    },
    {
      name: "VS Code Marketplace",
      value: `\`${vscodeVersion}\` ${syncEmoji(vscodeVersion === pkg)}`,
      inline: true,
    },
    {
      name: "Firefox AMO",
      value: firefoxVersion === "pending AMO" ? "pending AMO ⚠️" : `\`${firefoxVersion}\``,
      inline: true,
    },
    {
      name: "Release status",
      value: String(siteData.releaseStatus ?? "—"),
      inline: true,
    },
    {
      name: "Published version",
      value: `\`${siteData.publishedReleaseVersion ?? siteData.version ?? "—"}\``,
      inline: true,
    },
  ];
}

/**
 * @param {Record<string, unknown>|null|undefined} siteData
 * @returns {string}
 */
export function formatEngagementText(siteData) {
  const visitors = siteData?.visitors;
  if (!visitors) return "Engagement data unavailable.";
  const clicks = visitors.packageClicks ?? {};
  const clickLines = Object.entries(clicks)
    .map(([key, value]) => `  ${key} · ${formatDiscordCount(value)}`)
    .join("\n");
  return [
    "```",
    "Website engagement",
    `Visits ······· ${formatDiscordCount(visitors.websiteVisits)}`,
    `Engagement ··· ${formatDiscordCount(visitors.totalEngagement)}`,
    clickLines || "  (no package clicks yet)",
    "```",
  ].join("\n");
}

/**
 * Builds Markdown links to the product's primary resources and release information.
 * @param {string|null|undefined} tag - Release tag used to create a tag-specific release link.
 * @param {Object} footers - Optional configured footer content.
 * @returns {string} Markdown-formatted product links, optionally followed by a product footer.
 */
export function buildQuickLinksText(tag, footers) {
  const releaseTag = normalizeTag(tag);
  const releaseUrl = tag && tag !== "test"
    ? `${BRAND.repo}/releases/tag/${encodeURIComponent(releaseTag)}`
    : `${BRAND.repo}/releases`;
  const productLinks = [
    `[Product site](${BRAND.site})`,
    `[Mission Control](${BRAND.admin})`,
    `[GitHub release](${releaseUrl})`,
    `[Open VSX](${BRAND.ovsx})`,
    `[VS Code Marketplace](${BRAND.vscode})`,
    `[Changelog](${BRAND.repo}/blob/main/CHANGELOG.md)`,
  ].join(" · ");
  const productBlock = footers?.discord?.productBlock;
  if (productBlock) {
    return `${productLinks}\n\n${productBlock}`;
  }
  return productLinks;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string|null|undefined} tag
 * @returns {Promise<string|null>}
 */
async function fetchReleaseNotes(env, tag) {
  if (!tag || tag === "test") return null;
  const releaseTag = normalizeTag(tag);

  const releaseRes = await githubFetch(
    `/repos/${GITHUB_REPO}/releases/tags/${encodeURIComponent(releaseTag)}`,
    env
  );
  if (releaseRes.ok) {
    const release = await releaseRes.json();
    if (release?.body?.trim()) return release.body.trim();
  }

  const rawRes = await fetch(
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/CHANGELOG.md`,
    { headers: { Accept: "text/plain" } }
  );
  if (!rawRes.ok) return null;
  const markdown = await rawRes.text();
  return extractChangelogSection(markdown, releaseTag);
}

/**
 * Collects product data and formatted content for Discord deployment embeds.
 * @param {{ tag?: string|null; includeChangelog?: boolean }} options
 * @param {string|null} [options.tag] - Release tag used to retrieve release notes and build release links.
 * @param {boolean} [options.includeChangelog=true] - Whether to include release notes.
 * @returns {Promise<object>} Enriched branding, product data, marketplace fields, release notes, and formatted embed content.
 */
export async function buildDeployEnrichment(env, options = {}) {
  const tag = options.tag ?? null;
  let siteData = null;
  let channels = null;

  try {
    siteData = await fetchSiteData(env);
  } catch (error) {
    console.warn("Discord enrichment: site-data unavailable", error);
  }

  if (siteData) {
    try {
      channels = await fetchLiveChannels(siteData, { githubToken: env.GITHUB_TOKEN });
    } catch (error) {
      console.warn("Discord enrichment: live channels unavailable", error);
    }
  }

  let changelog = null;
  if (options.includeChangelog !== false && tag) {
    try {
      changelog = await fetchReleaseNotes(env, tag);
    } catch (error) {
      console.warn("Discord enrichment: changelog unavailable", error);
    }
  }

  const catalogBrand = await getMessageBranding(env);
  const catalogFooters = await getChannelFooters(env);

  return {
    brand: {
      ...BRAND,
      icon: catalogBrand.discordAvatarUrl ?? BRAND.icon,
    },
    catalogBrand,
    catalogFooters,
    siteData,
    channels,
    changelog,
    downloadBreakdown: formatDownloadBreakdownText(siteData),
    engagement: formatEngagementText(siteData),
    marketplaceFields: buildMarketplaceFields(siteData, channels),
    quickLinks: buildQuickLinksText(tag, catalogFooters),
  };
}
