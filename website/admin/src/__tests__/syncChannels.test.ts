import { describe, it, expect } from "vitest";
import { buildSyncChannels } from "../lib/syncChannels";
import type { SiteData } from "../lib/site-data";

describe("buildSyncChannels", () => {
  const base = {
    packageVersion: "0.5.8",
    github: { releaseTag: "v0.5.8", totalReleaseDownloads: 10, vsixDownloadCount: 5 },
    ovsx: { version: "0.5.8", downloadCount: 1 },
    vscode: { version: "0.5.7", downloadCount: 2 },
    ovsxDuplicate: { version: "0.5.8", downloadCount: 0 },
  };

  it("marks synced vs drift", () => {
    const data = { ...base, downloads: { verified: true, breakdown: {} } } as unknown as SiteData;
    const channels = buildSyncChannels(data);
    expect(channels.find((c) => c.id === "github")?.synced).toBe(true);
    expect(channels.find((c) => c.id === "vscode")?.synced).toBe(false);
    expect(channels.find((c) => c.id === "ovsx-duplicate")?.warn).toBe(true);
  });

  it("reports verified download counts", () => {
    const data = { ...base, downloads: { verified: true, breakdown: {} } } as unknown as SiteData;
    const channels = buildSyncChannels(data);
    expect(channels.find((c) => c.id === "github")?.downloadCount).toBe(10);
    expect(channels.find((c) => c.id === "vscode")?.downloadCount).toBe(2);
  });

  it("hides download counts when marketplace stats are unverified", () => {
    const data = { ...base, downloads: { verified: false, breakdown: {} } } as unknown as SiteData;
    for (const channel of buildSyncChannels(data)) {
      expect(channel.downloadCount).toBeNull();
    }
  });

  it("shows partial download counts when breakdown exists without full verification", () => {
    const data = {
      ...base,
      downloads: {
        verified: false,
        breakdown: {
          openVsxCanonical: 100,
          openVsxDuplicate: 50,
          vscodeMarketplace: 20,
          githubAllAssets: null,
        },
      },
    } as unknown as SiteData;
    const channels = buildSyncChannels(data);
    expect(channels.find((c) => c.id === "ovsx")?.downloadCount).toBe(100);
    expect(channels.find((c) => c.id === "vscode")?.downloadCount).toBe(20);
    expect(channels.find((c) => c.id === "github")?.downloadCount).toBeNull();
  });
});
