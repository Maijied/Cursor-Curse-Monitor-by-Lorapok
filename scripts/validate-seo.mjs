#!/usr/bin/env node
/**
 * Validates SEO artifacts produced by generate-seo.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const website = join(root, "website");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

let failed = false;

function fail(msg) {
  console.error(`::error::${msg}`);
  failed = true;
}

/**
 * Emits a GitHub Actions-formatted warning message.
 * @param {string} msg - The warning message.
 */
function warn(msg) {
  console.warn(`::warning::${msg}`);
}

/**
 * Extract the marked SEO block from an HTML document.
 * @param {string} html - The HTML document to inspect.
 * @return {string} The SEO block, or the complete document when no marked block exists.
 */
function readSeoBlock(html) {
  const m = html.match(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->/);
  return m?.[0] ?? html;
}

/**
 * Extracts the trimmed title text from an HTML document's SEO block.
 * @param {string} html - The HTML document to inspect.
 * @returns {string} The trimmed title text, or an empty string when no title is present.
 */
function readTitle(html) {
  const block = readSeoBlock(html);
  const m = block.match(/<title>([^<]*)<\/title>/);
  return m?.[1]?.trim() ?? "";
}

/**
 * Extracts the content of a named or property-based meta tag from an SEO block.
 * @param {string} html - The HTML document to search.
 * @param {string} name - The meta tag name or property value.
 * @return {string} The decoded meta tag content, or an empty string when no matching tag exists.
 */
function readMeta(html, name) {
  const block = readSeoBlock(html);
  const re = new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, "i");
  const alt = block.match(re);
  if (alt) return alt[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${name}"`, "i");
  return block.match(re2)?.[1]?.replace(/&amp;/g, "&") ?? "";
}

if (!existsSync(join(website, "seo.yml"))) {
  fail("Missing website/seo.yml — source of truth for SEO");
}

const sitemapPath = join(website, "sitemap.xml");
if (!existsSync(sitemapPath)) {
  fail("Missing website/sitemap.xml");
} else {
  const xml = readFileSync(sitemapPath, "utf8");
  if (!xml.includes("<urlset")) fail("sitemap.xml is not valid urlset XML");
  if (!xml.includes("lastmod")) warn("sitemap.xml has no lastmod entries");
  if (!xml.includes("/terms.html")) warn("sitemap.xml should include terms.html");
  if (xml.includes("LorapokLabs/cursor-curse")) {
    fail("sitemap.xml must not link to duplicate Open VSX LorapokLabs namespace");
  }
}

const seoPath = join(website, "seo.json");
if (!existsSync(seoPath)) {
  fail("Missing website/seo.json");
} else {
  const seo = JSON.parse(readFileSync(seoPath, "utf8"));
  if (!seo.canonical?.startsWith("https://")) fail("seo.json canonical must be https URL");
  if (!seo.source?.includes("seo.yml")) warn("seo.json should declare website/seo.yml as source");
  if (seo.packageVersion && seo.packageVersion !== pkg.version) {
    fail(`seo.json packageVersion ${seo.packageVersion} does not match package.json ${pkg.version}`);
  }
  if (!seo.openGraph?.image?.startsWith("https://")) fail("seo.json openGraph.image must be absolute https URL");
  if (!seo.twitter?.card) warn("seo.json missing twitter.card");
  if (!seo.marketplaces?.openVsxCanonical?.includes("lorapok-labs")) {
    fail("seo.json openVsxCanonical must use lorapok-labs namespace");
  }
  if (seo.marketplaces?.openVsxDuplicate) {
    warn("Duplicate Open VSX listing still referenced in seo.json — deprecate LorapokLabs namespace");
  }

  const indexHtml = readFileSync(join(website, "index.html"), "utf8");
  const htmlTitle = readTitle(indexHtml);
  if (htmlTitle && seo.title && htmlTitle !== seo.title) {
    fail(`index.html title does not match seo.json (run npm run site:seo)`);
  }
  const htmlDesc = readMeta(indexHtml, "description");
  if (htmlDesc && seo.description && htmlDesc !== seo.description) {
    fail(`index.html description does not match seo.json`);
  }
}

const robotsPath = join(website, "robots.txt");
if (!existsSync(robotsPath)) {
  fail("Missing website/robots.txt");
} else {
  const robots = readFileSync(robotsPath, "utf8");
  if (!robots.includes("Sitemap:")) fail("robots.txt must include Sitemap directive");
}

const ogImagePath = join(website, "assets/marketing/og-social-card.png");
if (!existsSync(ogImagePath)) {
  fail("Missing OG image at website/assets/marketing/og-social-card.png");
}

if (failed) process.exit(1);
console.log("SEO validation passed.");
