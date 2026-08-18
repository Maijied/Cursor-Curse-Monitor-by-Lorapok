import { describe, it, expect } from "vitest";
import { buildSyncChannels } from "../lib/syncChannels";
import type { SiteData } from "../lib/site-data";

describe("buildSyncChannels", () => {
  it("marks synced vs drift", () => {
    const data = {
      packageVersion: "0.5.8",
      github: { releaseTag: "v0.5.8", totalReleaseDownloads: 10, vsixDownloadCount: 5 },
      ovsx: { version: "0.5.8", downloadCount: 1 },
      vscode: { version: "0.5.7", downloadCount: 2 },
      ovsxDuplicate: { version: "0.5.8", downloadCount: 0 },
    } as unknown as SiteData;
    const channels = buildSyncChannels(data);
    expect(channels.find((c) => c.id === "github")?.synced).toBe(true);
    expect(channels.find((c) => c.id === "vscode")?.synced).toBe(false);
    expect(channels.find((c) => c.id === "ovsx-duplicate")?.warn).toBe(true);
  });
});
