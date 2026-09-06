import assert from "node:assert/strict";
import {
  buildEphemeralChannelOverlay,
  isStatsCacheStale,
  mergeSiteDataWithLiveCache,
} from "./stats-refresh.js";

const verifiedBase = {
  generatedAt: "2026-08-30T00:00:00.000Z",
  packageVersion: "1.0.125",
  version: "1.0.125",
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

const oneHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
assert.equal(isStatsCacheStale({ refreshedAt: oneHourAgo }), false);
assert.equal(isStatsCacheStale({ refreshedAt: twoHoursAgo }), true);
assert.equal(isStatsCacheStale(null), true);

const channels = [
  { id: "ovsx-canonical", version: "1.0.132", downloadCount: 100 },
  { id: "vscode", version: "1.0.132", downloadCount: 200 },
  { id: "package", version: "1.0.125" },
];
const overlay = buildEphemeralChannelOverlay(verifiedBase, channels);
assert.equal(overlay.livePackageVersion, "1.0.132");
assert.equal(overlay.ovsx.version, "1.0.132");

console.log("stats-refresh.test.mjs OK");
