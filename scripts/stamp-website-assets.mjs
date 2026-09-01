#!/usr/bin/env node
/**
 * Appends ?v={buildId} to local CSS/JS assets in marketing HTML pages.
 * Called from generate-site-data.mjs after site-data.json is written.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const website = join(root, "website");

/** @type {readonly string[]} */
const HTML_PAGES = ["index.html", "privacy.html", "terms.html"];

/** @type {readonly string[]} */
const ASSET_PATTERN =
  /(?<=(?:href|src)=["'])(?!https?:|\/\/|#|mailto:|data:)([a-zA-Z0-9_./-]+\.(?:css|js|mjs|svg|png|jpg|webp))(?=["'])/g;

/**
 * @param {string} html
 * @param {string} buildId
 */
export function stampHtmlAssets(html, buildId) {
  if (!buildId) return html;
  let out = html.replace(ASSET_PATTERN, (path) => {
    const base = path.split("?")[0];
    return `${base}?v=${buildId}`;
  });
  if (out.includes('name="ccm-build-id"')) {
    out = out.replace(
      /<meta\s+name="ccm-build-id"\s+content="[^"]*"\s*\/?>/,
      `<meta name="ccm-build-id" content="${buildId}" />`
    );
  } else {
    out = out.replace(
      /<meta charset="UTF-8"\s*\/>/,
      `<meta charset="UTF-8" />\n  <meta name="ccm-build-id" content="${buildId}" />`
    );
  }
  return out;
}

/**
 * @param {string} buildId
 */
export function stampWebsiteHtml(buildId) {
  if (!buildId) {
    console.warn("stamp-website-assets: skip — empty buildId");
    return;
  }
  for (const page of HTML_PAGES) {
    const path = join(website, page);
    const before = readFileSync(path, "utf8");
    const after = stampHtmlAssets(before, buildId);
    if (after !== before || !before.includes(`content="${buildId}"`)) {
      writeFileSync(path, after);
      console.log(`Stamped assets in ${path} (?v=${buildId})`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const buildId = process.argv[2];
  if (!buildId) {
    console.error("Usage: node scripts/stamp-website-assets.mjs <buildId>");
    process.exit(1);
  }
  stampWebsiteHtml(buildId);
}
