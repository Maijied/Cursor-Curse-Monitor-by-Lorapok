import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDownloadTotals, preserveVerifiedDownloads } from "./download-totals.mjs";

describe("computeDownloadTotals", () => {
  it("sums canonical open vsx, vscode, and github assets", () => {
    const result = computeDownloadTotals({
      openVsxCanonical: { version: "1.0.1", downloadCount: 100 },
      openVsxDuplicate: { version: "1.0.0", downloadCount: 50 },
      vscode: { downloadCount: 20 },
      githubAllAssets: 3,
      packageVersion: "1.0.1",
    });
    assert.equal(result.verified, true);
    assert.equal(result.displayTotal, 173);
    assert.equal(result.openVsxCombined, 150);
    assert.equal(result.breakdown.openVsxDuplicate, 50);
    assert.equal(result.source, "canonical");
  });

  it("marks totals unverified when github releases are unavailable", () => {
    const result = computeDownloadTotals({
      openVsxCanonical: { version: "1.0.1", downloadCount: 100 },
      githubAllAssets: null,
      packageVersion: "1.0.1",
    });
    assert.equal(result.verified, false);
    assert.equal(result.displayTotal, null);
    assert.equal(result.breakdown.githubAllAssets, null);
  });

  it("marks totals unverified when vscode marketplace is unavailable", () => {
    const result = computeDownloadTotals({
      openVsxCanonical: { version: "1.0.1", downloadCount: 100 },
      githubAllAssets: 3,
      packageVersion: "1.0.1",
    });
    assert.equal(result.verified, false);
    assert.equal(result.displayTotal, null);
  });

  it("preserves verified totals when live refresh is incomplete", () => {
    const previous = {
      verified: true,
      total: 13356,
      displayTotal: 13356,
      liveSources: {
        openVsxCanonical: true,
        openVsxDuplicate: true,
        vscodeMarketplace: true,
        githubReleases: true,
      },
      breakdown: { githubAllAssets: 3 },
    };
    const next = computeDownloadTotals({
      openVsxCanonical: { version: "1.0.1", downloadCount: 100 },
      vscode: { downloadCount: 20 },
      githubAllAssets: null,
      packageVersion: "1.0.1",
    });
    const preserved = preserveVerifiedDownloads(previous, next);
    assert.equal(preserved.verified, true);
    assert.equal(preserved.total, 13356);
    assert.equal(preserved.displayTotal, 13356);
  });

  it("uses duplicate fallback display when canonical lags package version", () => {
    const result = computeDownloadTotals({
      openVsxCanonical: { version: "0.5.14", downloadCount: 3251 },
      openVsxDuplicate: { version: "0.5.18", downloadCount: 786 },
      vscode: { downloadCount: 0 },
      githubAllAssets: 3,
      packageVersion: "0.5.18",
    });
    assert.equal(result.source, "duplicate-fallback-display");
    assert.equal(result.displayTotal, 4040);
    assert.equal(result.openVsxCombined, 4037);
    assert.equal(result.breakdown.openVsxDisplay, 3251);
  });
});
