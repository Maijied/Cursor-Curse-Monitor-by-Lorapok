#!/usr/bin/env node
/**
 * Writes website/readme-stats.svg and Shields.io badge JSON from site-data.json.
 * Static files are served from GitHub raw so shields.io avoids Cloudflare bot challenges.
 * When marketplace sources are unverified, badges/charts show unavailable — never zero-filled.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReadmeStatsFromSiteData,
  renderReadmeStatsSvg,
  renderShieldsBadge,
} from "../website/admin/functions/api/_shared/readme-stats.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteDataPath = join(root, "website", "site-data.json");
const statsDir = join(root, "website", "stats");
const svgPath = join(root, "website", "readme-stats.svg");
const pngPath = join(root, "website", "readme-stats.png");

const data = JSON.parse(readFileSync(siteDataPath, "utf8"));
const stats = buildReadmeStatsFromSiteData(data);

mkdirSync(statsDir, { recursive: true });
const svg = renderReadmeStatsSvg(stats);
writeFileSync(svgPath, svg);

try {
  execFileSync("rsvg-convert", ["-w", "720", svgPath, "-o", pngPath], { stdio: "inherit" });
  console.log(`Wrote ${pngPath}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.CI === "true") {
    throw new Error(`readme-stats.png required in CI (install librsvg2-bin): ${message}`);
  }
  console.warn(`Skip ${pngPath} (rsvg-convert unavailable): ${message}`);
}

/** @type {const} */
const badgeFiles = [
  ["badge.json", "total"],
  ["badge-openvsx.json", "openvsx"],
  ["badge-openvsx-total.json", "openvsx-total"],
  ["badge-vscode.json", "vscode"],
];

for (const [filename, kind] of badgeFiles) {
  const path = join(statsDir, filename);
  writeFileSync(path, `${JSON.stringify(renderShieldsBadge(stats, kind), null, 2)}\n`);
  console.log(`Wrote ${path}`);
}

if (stats.verified) {
  console.log(
    `Wrote ${svgPath} (total ${stats.total?.toLocaleString()}, Open VSX ${stats.openVsxCombined?.toLocaleString()})`
  );
} else {
  console.warn(`Wrote ${svgPath} (download stats unverified — badges show unavailable)`);
}
