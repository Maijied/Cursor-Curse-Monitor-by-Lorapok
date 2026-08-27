import assert from "node:assert/strict";
import {
  buildReadmeStatsFromSiteData,
  isVerifiedDownloadStats,
  renderShieldsBadge,
} from "../website/admin/functions/api/_shared/readme-stats.js";

assert.equal(isVerifiedDownloadStats({ downloads: { verified: true } }), true);
assert.equal(isVerifiedDownloadStats({ downloads: { verified: false } }), false);

const verified = buildReadmeStatsFromSiteData({
  generatedAt: "2026-08-27T00:00:00.000Z",
  packageVersion: "1.0.26",
  downloads: {
    verified: true,
    total: 5806,
    openVsxCombined: 9611,
    breakdown: {
      openVsxCanonical: 5798,
      openVsxDuplicate: 3813,
      vscodeMarketplace: null,
      githubAllAssets: 8,
    },
  },
});
assert.equal(verified.verified, true);
assert.equal(renderShieldsBadge(verified, "total").message, "5.8k total");

const unverified = buildReadmeStatsFromSiteData({
  downloads: { verified: false, total: 0, breakdown: {} },
});
assert.equal(unverified.verified, false);
assert.equal(renderShieldsBadge(unverified, "total").message, "unavailable");

console.log("readme-stats.test.mjs: OK");
