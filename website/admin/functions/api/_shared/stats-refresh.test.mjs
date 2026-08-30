import assert from "node:assert/strict";
import { mergeSiteDataWithLiveCache } from "./stats-refresh.js";

const verifiedBase = {
  generatedAt: "2026-08-30T00:00:00.000Z",
  downloads: {
    verified: true,
    total: 13356,
    displayTotal: 13356,
    breakdown: { githubAllAssets: 3 },
  },
};

const unverifiedCache = {
  refreshedAt: "2026-08-30T03:00:00.000Z",
  downloads: {
    verified: false,
    total: null,
    displayTotal: null,
    breakdown: { githubAllAssets: null },
  },
};

const merged = mergeSiteDataWithLiveCache(verifiedBase, unverifiedCache);
assert.equal(merged.downloads.verified, true);
assert.equal(merged.downloads.total, 13356);
assert.equal(merged.generatedAt, unverifiedCache.refreshedAt);

const freshVerified = mergeSiteDataWithLiveCache(verifiedBase, {
  refreshedAt: "2026-08-30T04:00:00.000Z",
  downloads: {
    verified: true,
    total: 14000,
    displayTotal: 14000,
  },
});
assert.equal(freshVerified.downloads.total, 14000);

console.log("stats-refresh.test.mjs OK");
