import { describe, expect, it } from "vitest";
import type { SiteData } from "./site-data";
import {
  formatDownloadCount,
  getDisplayDownloadTotal,
  getVerifiedDownloadTotal,
  getVerifiedChannelCount,
} from "./download-stats";

describe("download stats display", () => {
  it("formats fail-closed as an em dash", () => {
    expect(formatDownloadCount(null)).toBe("—");
    expect(formatDownloadCount(undefined)).toBe("—");
    expect(formatDownloadCount(9975)).toBe((9975).toLocaleString());
  });

  it("hides totals when marketplace stats are unverified", () => {
    const data = {
      downloads: { verified: false, total: 0, displayTotal: 0 },
    } as SiteData;
    expect(getVerifiedDownloadTotal(data)).toBeNull();
    expect(getDisplayDownloadTotal(data)).toBeNull();
  });

  it("prefers displayTotal for the verified grand total", () => {
    const data = {
      downloads: { verified: true, total: 1, displayTotal: 9975 },
    } as SiteData;
    expect(getVerifiedDownloadTotal(data)).toBe(9975);
    expect(getDisplayDownloadTotal(data)).toBe(9975);
  });

  it("sums marketplace channels when GitHub aggregation is missing", () => {
    const data = {
      ovsx: { downloadCount: 7855, version: "1.0.61" },
      ovsxDuplicate: { downloadCount: 6041, version: "1.0.61" },
      vscode: { downloadCount: 518, version: "1.0.61" },
      github: { releaseTag: "v1.0.61", totalReleaseDownloads: 12 },
      downloads: {
        verified: false,
        breakdown: {
          openVsxCanonical: 7855,
          openVsxDuplicate: 6041,
          vscodeMarketplace: 518,
          githubAllAssets: null,
        },
      },
    } as SiteData;
    expect(getDisplayDownloadTotal(data)).toBe(14414);
    expect(getVerifiedChannelCount(data, "openVsxCanonical")).toBe(7855);
    expect(getVerifiedChannelCount(data, "githubAllAssets")).toBeNull();
  });
});
