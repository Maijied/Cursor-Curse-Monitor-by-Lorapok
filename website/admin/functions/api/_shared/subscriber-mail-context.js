import { getMessageCatalog } from "./message-cards-runtime.js";
import { resolveProductContext } from "./product-context-runtime.js";
import { fetchSiteData, packageVersionFromSiteData } from "./site-data.js";
import { getAdminPublicUrl } from "./mail.js";

/** @typedef {import("./subscribers.js").SubscriberRecord} SubscriberRecord */

/**
 * Derive a friendly display name from an email local part.
 * @param {string} email
 */
export function subscriberDisplayName(email) {
  const local = String(email ?? "")
    .split("@")[0]
    .replace(/[._+-]+/g, " ")
    .trim();
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Human-readable platform label from subscribe source.
 * @param {string | null | undefined} source
 */
export function formatSubscriberPlatform(source) {
  const key = String(source ?? "website").trim().toLowerCase();
  const labels = {
    website: "Website",
    extension: "Browser extension",
    "browser-extension": "Browser extension",
    admin: "Mission Control",
    legacy: "Product updates",
  };
  return labels[key] ?? key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * One-line stats summary for subscriber merge tags.
 * @param {Record<string, unknown>} productCtx
 * @param {Record<string, unknown> | null | undefined} siteData
 */
export function formatSubscriberStatsLine(productCtx, siteData) {
  const version =
    String(productCtx.releaseVersion ?? productCtx.version ?? "").trim() ||
    packageVersionFromSiteData(siteData ?? {}) ||
    "latest";
  const downloads =
    siteData?.githubCommunity?.totalDownloads ??
    siteData?.stats?.totalDownloads ??
    siteData?.downloads ??
    null;
  if (downloads != null && Number.isFinite(Number(downloads))) {
    const n = Number(downloads);
    const formatted = n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
    return `Latest release v${version.replace(/^v/i, "")} · ${formatted}+ community downloads`;
  }
  return `Latest release v${String(version).replace(/^v/i, "")} from Lorapok Labs`;
}

/**
 * Build merge-tag context for a subscriber email.
 * @param {SubscriberRecord} subscriber
 * @param {Record<string, unknown>} productCtx
 * @param {Record<string, unknown> | null | undefined} [siteData]
 * @param {Record<string, unknown>} [env]
 */
export function buildSubscriberMergeContext(subscriber, productCtx, siteData = null, env = {}) {
  const catalog = getMessageCatalog();
  const footers = catalog.footers?.email ?? {};
  const homepage = String(productCtx.homepage ?? "https://cursor.lorapok.tech").replace(/\/$/, "");
  const adminUrl = getAdminPublicUrl(env);
  const email = String(subscriber.email ?? "").trim().toLowerCase();

  return {
    ...productCtx,
    email,
    name: subscriberDisplayName(email),
    platform: formatSubscriberPlatform(subscriber.source),
    stats: formatSubscriberStatsLine(productCtx, siteData),
    unsubscribeHint:
      footers.unsubscribeHint ??
      "Reply to this email any time to unsubscribe from product updates.",
    unsubscribeUrl: `${homepage}/#subscribe`,
    adminUrl,
    homepage,
  };
}

/**
 * Resolve product + site-data context for subscriber mail.
 * @param {Record<string, unknown>} env
 */
export async function resolveSubscriberMailContext(env) {
  const productCtx = await resolveProductContext(env);
  let siteData = null;
  try {
    siteData = await fetchSiteData(env);
  } catch {
    siteData = null;
  }
  return { productCtx, siteData };
}
