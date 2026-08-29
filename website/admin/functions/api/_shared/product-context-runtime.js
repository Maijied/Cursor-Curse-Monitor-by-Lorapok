import embedded from "./product-context.embedded.json" with { type: "json" };
import {
  fetchSiteData,
  liveTagFromSiteData,
  packageVersionFromSiteData,
} from "./site-data.js";
import { interpolateDeep } from "./template-interpolate.js";

/**
 * Merge live site-data version fields into the embedded product context.
 * @param {Record<string, unknown>} baseCtx
 * @param {Record<string, unknown>|null|undefined} siteData
 */
export function mergeProductContext(baseCtx, siteData) {
  const ctx = { ...baseCtx };
  if (!siteData) return ctx;

  const packageVersion =
    packageVersionFromSiteData(siteData) || String(ctx.packageVersion ?? "").replace(/^v/, "");
  const releaseTag = liveTagFromSiteData(siteData);
  const publishedRaw =
    siteData.publishedReleaseVersion ?? siteData?.github?.releaseTag ?? releaseTag ?? packageVersion;
  const publishedReleaseVersion = String(publishedRaw ?? "")
    .replace(/^v/i, "")
    .trim();
  const releaseVersion = publishedReleaseVersion || packageVersion || String(ctx.releaseVersion ?? "");
  const repo = String(ctx.repo ?? "Maijied/Cursor-Curse-Monitor-by-Lorapok");
  const homepage = String(ctx.homepage ?? "https://cursor.lorapok.tech").replace(/\/$/, "");

  ctx.packageVersion = packageVersion || ctx.packageVersion;
  ctx.releaseVersion = releaseVersion;
  ctx.version = releaseVersion;
  ctx.publishedReleaseVersion = publishedReleaseVersion || releaseVersion;
  ctx.releaseTag = releaseTag ?? `v${releaseVersion}`;
  ctx.releaseUrl = `https://github.com/${repo}/releases/tag/v${releaseVersion}`;
  ctx.latestReleaseUrl = `https://github.com/${repo}/releases/latest`;
  ctx.homepage = homepage;
  ctx.mainLogoUrl = `${homepage}/assets/icon.png`;
  ctx.discordAvatarUrl = `${homepage}/assets/icon.png`;

  if (siteData.releaseHighlights) {
    ctx.releaseHighlights = String(siteData.releaseHighlights);
  }

  return ctx;
}

/**
 * @param {Record<string, unknown>} [env]
 */
export async function resolveProductContext(env) {
  const base = { ...(embedded.ctx ?? {}) };
  try {
    const site = await fetchSiteData(env ?? {});
    return mergeProductContext(base, site);
  } catch (error) {
    console.warn("resolveProductContext: site-data unavailable, using embedded ctx", error);
    return base;
  }
}

/**
 * @param {unknown} templateValue
 * @param {Record<string, unknown>} [env]
 */
export async function hydrateTemplateValue(templateValue, env) {
  const ctx = await resolveProductContext(env);
  return interpolateDeep(templateValue, ctx);
}
