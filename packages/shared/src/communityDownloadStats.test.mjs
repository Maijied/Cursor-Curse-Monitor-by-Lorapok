import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMUNITY_DOWNLOADS_NOTE,
  formatCommunityCount,
  formatCommunityDownloadsBreakdown,
  formatCommunityDownloadsHeadline,
  parseCommunityDownloadsFromSiteData,
} from "../dist/communityDownloadStats.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const siteDataPath = join(repoRoot, "website/site-data.json");
const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
const downloads = siteData.downloads ?? {};

const verified = parseCommunityDownloadsFromSiteData(siteData);

assert.equal(verified.verified, downloads.verified === true);
if (verified.verified) {
  const expectedTotal = Number(downloads.displayTotal ?? downloads.total);
  assert.equal(verified.total, expectedTotal);
  assert.equal(
    formatCommunityDownloadsHeadline(verified),
    `${formatCommunityCount(expectedTotal)} total downloads`
  );

  const vscodeCount = verified.breakdown.vscodeMarketplace;
  if (vscodeCount != null) {
    assert.match(
      formatCommunityDownloadsBreakdown(verified),
      new RegExp(`VS Code ${formatCommunityCount(vscodeCount).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
    );
  }

  const canonical = Number(downloads.breakdown?.openVsxCanonical ?? siteData.ovsx?.downloadCount);
  const duplicate = Number(downloads.breakdown?.openVsxDuplicate ?? siteData.ovsxDuplicate?.downloadCount);
  if (!Number.isNaN(canonical)) {
    assert.equal(verified.breakdown.openVsxCanonical, canonical);
  }
  if (!Number.isNaN(duplicate)) {
    assert.equal(verified.breakdown.openVsxDuplicate, duplicate);
  }
}

assert.equal(verified.note, downloads.note ?? COMMUNITY_DOWNLOADS_NOTE);

const unverified = parseCommunityDownloadsFromSiteData({
  downloads: { verified: false, total: 0, breakdown: {} },
});
assert.equal(unverified.verified, false);
assert.equal(formatCommunityCount(null), "—");
assert.equal(formatCommunityDownloadsHeadline(unverified), "Community downloads unavailable");

console.log("communityDownloadStats.test.mjs: OK");
