#!/usr/bin/env node
/**
 * Validates SEO artifacts produced by generate-seo.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const website = join(root, "website");

let failed = false;

function fail(msg) {
  console.error(`::error::${msg}`);
  failed = true;
}

function warn(msg) {
  console.warn(`::warning::${msg}`);
}

const sitemapPath = join(website, "sitemap.xml");
if (!existsSync(sitemapPath)) {
  fail("Missing website/sitemap.xml");
} else {
  const xml = readFileSync(sitemapPath, "utf8");
  if (!xml.includes("<urlset")) fail("sitemap.xml is not valid urlset XML");
  if (!xml.includes("lastmod")) warn("sitemap.xml has no lastmod entries");
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
  if (!seo.marketplaces?.openVsxCanonical?.includes("lorapok-labs")) {
    fail("seo.json openVsxCanonical must use lorapok-labs namespace");
  }
  if (seo.marketplaces?.openVsxDuplicate) {
    warn("Duplicate Open VSX listing still referenced in seo.json — deprecate LorapokLabs namespace");
  }
}

const robotsPath = join(website, "robots.txt");
if (!existsSync(robotsPath)) {
  fail("Missing website/robots.txt");
} else {
  const robots = readFileSync(robotsPath, "utf8");
  if (!robots.includes("Sitemap:")) fail("robots.txt must include Sitemap directive");
}

if (failed) process.exit(1);
console.log("SEO validation passed.");
