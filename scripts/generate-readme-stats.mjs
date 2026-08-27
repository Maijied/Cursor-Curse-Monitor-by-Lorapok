#!/usr/bin/env node
/**
 * Writes website/readme-stats.svg from site-data.json for GitHub Pages + README fallback.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReadmeStatsFromSiteData,
  renderReadmeStatsSvg,
} from "../website/admin/functions/api/_shared/readme-stats.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteDataPath = join(root, "website", "site-data.json");
const outPath = join(root, "website", "readme-stats.svg");

const data = JSON.parse(readFileSync(siteDataPath, "utf8"));
const stats = buildReadmeStatsFromSiteData(data);
const svg = renderReadmeStatsSvg(stats);
writeFileSync(outPath, svg);
console.log(`Wrote ${outPath} (total ${stats.total.toLocaleString()}, Open VSX ${stats.openVsxCombined.toLocaleString()})`);
