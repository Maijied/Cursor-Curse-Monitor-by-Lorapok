import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildQuickLinksText,
  extractChangelogSection,
} from "../website/admin/functions/api/_shared/discord-deploy-context.js";
import { buildLocalDeploySyncStat } from "../website/admin/functions/api/_shared/deploy-sync-stat-service.js";
import embedded from "../website/admin/functions/api/_shared/product-context.embedded.json" with { type: "json" };
import { mergeProductContext } from "../website/admin/functions/api/_shared/product-context-runtime.js";
import { interpolateDeep } from "../website/admin/functions/api/_shared/template-interpolate.js";
import { getMessageCatalog } from "../website/admin/functions/api/_shared/message-cards-runtime.js";

const BRAND = {
  site: "https://cursor.lorapok.tech",
  admin: "https://cursor-dev.lorapok.tech",
  icon: "https://cursor.lorapok.tech/assets/logo.png",
};

const SITE_DATA_CANDIDATES = [
  "website/admin/dist/site-data.json",
  "website/site-data.json",
];

/**
 * @param {string} repoRoot
 * @param {string} [explicitPath]
 * @returns {Record<string, unknown>|null}
 */
export function readLocalSiteDataForDiscord(repoRoot, explicitPath) {
  const candidates = explicitPath
    ? [explicitPath]
    : SITE_DATA_CANDIDATES.map((rel) => join(repoRoot, rel));

  for (const path of candidates) {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Headless enrichment for CI scripts — reads committed repo files (no KV / network).
 * @param {{ tag?: string|null; includeChangelog?: boolean; repoRoot?: string; siteDataPath?: string }} [options]
 */
export function buildLocalDeployEnrichment(options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const tag = options.tag ?? null;
  const includeChangelog = options.includeChangelog !== false;

  const siteData = readLocalSiteDataForDiscord(repoRoot, options.siteDataPath);
  if (!siteData) {
    console.warn("Discord CI enrichment: site-data unavailable");
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
  const ctx = mergeProductContext(embedded.ctx ?? {}, siteData);
  const catalogBrand = interpolateDeep(catalog.branding ?? {}, ctx);
  const catalogFooters = interpolateDeep(catalog.footers ?? {}, ctx);
  const syncStat = buildLocalDeploySyncStat(siteData, { deployedTag: tag });

  return {
    brand: {
      ...BRAND,
      icon: catalogBrand.discordAvatarUrl ?? BRAND.icon,
    },
    catalogBrand,
    catalogFooters,
    siteData: syncStat.siteData,
    channels: syncStat.channels,
    syncStat,
    changelog,
    downloadBreakdown: syncStat.downloadBreakdown,
    engagement: syncStat.engagementText,
    marketplaceFields: syncStat.marketplaceFields,
    quickLinks: buildQuickLinksText(tag, catalogFooters),
  };
}
