import assert from "node:assert/strict";
import {
  COMMUNITY_DOWNLOADS_NOTE,
  formatCommunityCount,
  formatCommunityDownloadsBreakdown,
  formatCommunityDownloadsHeadline,
  parseCommunityDownloadsFromSiteData,
} from "../dist/communityDownloadStats.js";

const verified = parseCommunityDownloadsFromSiteData({
  downloads: {
    verified: true,
    total: 9975,
    openVsxCombined: 9611,
    note: COMMUNITY_DOWNLOADS_NOTE,
    breakdown: {
      openVsxCanonical: 5798,
      openVsxDuplicate: 3813,
      vscodeMarketplace: 356,
      githubAllAssets: 8,
    },
  },
});

assert.equal(verified.total, 9975);
assert.equal(formatCommunityDownloadsHeadline(verified), "9,975 total downloads");
assert.match(formatCommunityDownloadsBreakdown(verified), /VS Code 356/);

const unverified = parseCommunityDownloadsFromSiteData({
  downloads: { verified: false, total: 0, breakdown: {} },
});
assert.equal(unverified.verified, false);
assert.equal(formatCommunityCount(null), "—");
assert.equal(formatCommunityDownloadsHeadline(unverified), "Community downloads unavailable");

console.log("communityDownloadStats.test.mjs: OK");
