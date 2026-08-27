import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeDownloadTotals } from "./download-totals.mjs";

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
    assert.equal(result.displayTotal, 123);
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

  it("uses duplicate fallback display when canonical lags package version", () => {
    const result = computeDownloadTotals({
      openVsxCanonical: { version: "0.5.14", downloadCount: 3251 },
      openVsxDuplicate: { version: "0.5.18", downloadCount: 786 },
      vscode: { downloadCount: 0 },
      githubAllAssets: 3,
      packageVersion: "0.5.18",
    });
    assert.equal(result.source, "duplicate-fallback-display");
    assert.equal(result.displayTotal, 3254);
    assert.equal(result.canonicalTotal, 3254);
  });
});
