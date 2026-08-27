import { describe, expect, it } from "vitest";
import type { SiteData } from "./site-data";
import { formatDownloadCount, getVerifiedDownloadTotal } from "./download-stats";

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
  });

  it("prefers displayTotal for the verified grand total", () => {
    const data = {
      downloads: { verified: true, total: 1, displayTotal: 9975 },
    } as SiteData;
    expect(getVerifiedDownloadTotal(data)).toBe(9975);
  });
});
