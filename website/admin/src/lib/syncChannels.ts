import type { SiteData } from "./site-data";

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
      downloadCount: data.github.totalReleaseDownloads ?? data.github.vsixDownloadCount ?? null,
      synced: data.github.releaseTag.replace(/^v/, "") === pkg,
    },
    {
      id: "ovsx",
      label: "Open VSX",
      version: data.ovsx.version,
      downloadCount: data.ovsx.downloadCount ?? null,
      synced: data.ovsx.version === pkg,
    },
    {
      id: "vscode",
      label: "VS Code",
      version: data.vscode.version,
      downloadCount: data.vscode.downloadCount ?? data.vscode.installCount ?? null,
      synced: data.vscode.version === pkg,
    },
    {
      id: "ovsx-duplicate",
      label: "Open VSX duplicate",
      version: data.ovsxDuplicate?.version ?? null,
      downloadCount: data.ovsxDuplicate?.downloadCount ?? null,
      synced: false,
      warn: true,
    },
  ];
}
