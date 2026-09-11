import assert from "node:assert/strict";
import {
  applyDeployedVersionOverlay,
  buildDeploySyncStatPayload,
  buildLocalDeploySyncStat,
  normalizeDeployVersion,
  resolveMarketplaceSyncStatus,
} from "./deploy-sync-stat-service.js";

const staleSiteData = {
  packageVersion: "1.0.132",
  version: "1.0.132",
  publishedReleaseVersion: "1.0.132",
  syncStatus: "synced",
  github: { releaseTag: "v1.0.132" },
  ovsx: { version: "1.0.132", downloadCount: 100 },
  vscode: { version: "1.0.132", downloadCount: 200 },
  downloads: {
    verified: true,
    displayTotal: 5000,
    breakdown: { vscodeMarketplace: 200, openVsxCanonical: 100 },
  },
  visitors: { websiteVisits: 42, totalEngagement: 99, packageClicks: { ovsx: 3 } },
};

const liveChannels = [
  { id: "github-release", version: "1.0.160" },
  { id: "ovsx-canonical", version: "1.0.160" },
  { id: "ovsx-duplicate", version: "1.0.160" },
  { id: "vscode", version: "1.0.160" },
  { id: "firefox-amo", version: "1.0.160", published: true },
];

assert.equal(normalizeDeployVersion("v1.0.160"), "1.0.160");
assert.equal(normalizeDeployVersion("0.0.0"), null);

const overlaid = applyDeployedVersionOverlay(staleSiteData, "v1.0.160");
assert.equal(overlaid.packageVersion, "1.0.160");
assert.equal(overlaid.github.releaseTag, "v1.0.160");
assert.equal(overlaid.marketplaceSync.packageVersion, "1.0.160");

assert.equal(resolveMarketplaceSyncStatus("1.0.160", liveChannels), "synced");
assert.equal(resolveMarketplaceSyncStatus("1.0.132", liveChannels), "drift");
assert.equal(resolveMarketplaceSyncStatus("1.0.160", null), "unknown");

const deployedPayload = buildDeploySyncStatPayload(staleSiteData, liveChannels, {
  deployedTag: "v1.0.160",
});
assert.equal(deployedPayload.packageVersion, "1.0.160");
assert.equal(deployedPayload.deployedVersion, "v1.0.160");
assert.equal(deployedPayload.syncStatus, "synced");
assert.match(
  deployedPayload.marketplaceFields.find((field) => field.name === "Package")?.value ?? "",
  /`1\.0\.160`/,
);
assert.match(
  deployedPayload.marketplaceFields.find((field) => field.name === "GitHub release")?.value ?? "",
  /`v1\.0\.160`/,
);

const stalePayload = buildDeploySyncStatPayload(staleSiteData, liveChannels);
assert.equal(stalePayload.packageVersion, "1.0.132");
assert.equal(stalePayload.syncStatus, "drift");

const localPayload = buildLocalDeploySyncStat(staleSiteData, { deployedTag: "v1.0.160" });
assert.equal(localPayload.packageVersion, "1.0.160");
assert.match(localPayload.downloadBreakdown, /5,000/);
assert.match(localPayload.engagementText, /42/);

const channelBackedFields = deployedPayload.marketplaceFields;
assert.match(
  channelBackedFields.find((field) => field.name === "Open VSX")?.value ?? "",
  /`1\.0\.160`/,
  "Open VSX field must use live channel version, not stale site-data",
);
assert.match(
  channelBackedFields.find((field) => field.name === "VS Code Marketplace")?.value ?? "",
  /`1\.0\.160`/,
);

const missingChannelsPayload = buildDeploySyncStatPayload(staleSiteData, null, {
  deployedTag: "v1.0.160",
});
assert.equal(missingChannelsPayload.syncStatus, "unknown");
assert.equal(missingChannelsPayload.packageVersion, "1.0.160");

const onlyPackageChannel = [{ id: "package", version: "1.0.160" }];
assert.equal(resolveMarketplaceSyncStatus("1.0.160", onlyPackageChannel), "unknown");

console.log("deploy-sync-stat-service.test.mjs: OK");
