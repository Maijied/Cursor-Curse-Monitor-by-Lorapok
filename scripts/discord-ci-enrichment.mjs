import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMarketplaceFields,
  buildQuickLinksText,
  extractChangelogSection,
  formatDownloadBreakdownText,
  formatEngagementText,
} from "../website/admin/functions/api/_shared/discord-deploy-context.js";
import { getMessageCatalog } from "../website/admin/functions/api/_shared/message-cards-runtime.js";

const BRAND = {
  site: "https://cursor.lorapok.tech",
  admin: "https://cursor-dev.lorapok.tech",
  icon: "https://cursor.lorapok.tech/assets/logo.png",
};

/**
 * Headless enrichment for CI scripts — reads committed repo files (no KV / network).
 * @param {{ tag?: string|null; includeChangelog?: boolean; repoRoot?: string }} [options]
 */
export function buildLocalDeployEnrichment(options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const tag = options.tag ?? null;
  const includeChangelog = options.includeChangelog !== false;

  let siteData = null;
  try {
    const raw = readFileSync(join(repoRoot, "website/site-data.json"), "utf8");
    siteData = JSON.parse(raw);
  } catch (error) {
    console.warn("Discord CI enrichment: site-data unavailable", error);
  }

  let changelog = null;
  if (includeChangelog && tag) {
    try {
      const markdown = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
      changelog = extractChangelogSection(markdown, tag);
    } catch (error) {
      console.warn("Discord CI enrichment: changelog unavailable", error);
    }
  }

  const catalog = getMessageCatalog();
  const catalogBrand = catalog.branding ?? {};
  const catalogFooters = catalog.footers ?? {};

  return {
    brand: {
      ...BRAND,
      icon: catalogBrand.discordAvatarUrl ?? BRAND.icon,
    },
    catalogBrand,
    catalogFooters,
    siteData,
    channels: null,
    changelog,
    downloadBreakdown: formatDownloadBreakdownText(siteData),
    engagement: formatEngagementText(siteData),
    marketplaceFields: buildMarketplaceFields(siteData, null),
    quickLinks: buildQuickLinksText(tag, catalogFooters),
  };
}
