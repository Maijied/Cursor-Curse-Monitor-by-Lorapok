import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReadmeStatsFromSiteData,
  renderShieldsBadge,
} from "../website/admin/functions/api/_shared/readme-stats.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteData = JSON.parse(readFileSync(join(root, "website/site-data.json"), "utf8"));
const badge = JSON.parse(readFileSync(join(root, "website/stats/badge.json"), "utf8"));
const stats = buildReadmeStatsFromSiteData(siteData);
const expected = renderShieldsBadge(stats, "total");

assert.equal(badge.message, expected.message, "badge.json message must match site-data totals");
assert.equal(badge.label, expected.label);
assert.equal(badge.color, expected.color);

console.log("test_badge_site_data_sync.mjs: OK");
