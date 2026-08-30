import assert from "node:assert/strict";
import {
  computeDownloadTotals,
  preserveVerifiedDownloads,
} from "./download-totals.js";

const totals = computeDownloadTotals({
  openVsxCanonical: { version: "1.0.1", downloadCount: 100 },
  openVsxDuplicate: { version: "1.0.0", downloadCount: 50 },
  vscode: { downloadCount: 20 },
  githubAllAssets: 3,
  packageVersion: "1.0.1",
});
assert.equal(totals.verified, true);
assert.equal(totals.displayTotal, 173);

const preserved = preserveVerifiedDownloads(
  { verified: true, total: 13356, displayTotal: 13356 },
  computeDownloadTotals({
    openVsxCanonical: { version: "1.0.1", downloadCount: 100 },
    vscode: { downloadCount: 20 },
    githubAllAssets: null,
    packageVersion: "1.0.1",
  }),
);
assert.equal(preserved.verified, true);
assert.equal(preserved.total, 13356);

console.log("download-totals-edge.test.mjs OK");
