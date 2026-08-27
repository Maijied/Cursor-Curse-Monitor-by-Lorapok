import type { SiteData } from "./site-data";
import { getVerifiedChannelCount } from "./download-stats";

export type SyncChannel = {
  id: string;
  label: string;
  version: string | null;
  downloadCount?: number | null;
  synced: boolean;
  warn?: boolean;
};

/** Build labeled marketplace channel rows for ChannelSyncStrip. */
export function buildSyncChannels(data: SiteData): SyncChannel[] {
  const pkg = data.packageVersion;
  return [
    {
      id: "github",
      label: "GitHub",
      version: data.github.releaseTag.replace(/^v/, "") || null,
      downloadCount: getVerifiedChannelCount(data, "githubAllAssets"),
      synced: data.github.releaseTag.replace(/^v/, "") === pkg,
    },
    {
      id: "ovsx",
      label: "Open VSX",
      version: data.ovsx.version,
      downloadCount: getVerifiedChannelCount(data, "openVsxCanonical"),
      synced: data.ovsx.version === pkg,
    },
    {
      id: "vscode",
      label: "VS Code",
      version: data.vscode.version,
      downloadCount: getVerifiedChannelCount(data, "vscodeMarketplace"),
      synced: data.vscode.version === pkg,
    },
    {
      id: "ovsx-duplicate",
      label: "Open VSX (LorapokLabs)",
      version: data.ovsxDuplicate?.version ?? null,
      downloadCount: getVerifiedChannelCount(data, "openVsxDuplicate"),
      synced: false,
      warn: true,
    },
  ];
}
