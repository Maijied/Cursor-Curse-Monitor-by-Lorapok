import type { SiteData } from "./site-data";
import { COMMUNITY_DOWNLOADS_NOTE } from "@lorapok/cursor-monitor-shared";

export { COMMUNITY_DOWNLOADS_NOTE };

export interface DownloadChannelSlice {
  id: string;
  label: string;
  count: number;
  inTotal: boolean;
}

/** Format a download count; null/undefined → em dash (fail-closed). */
export function formatDownloadCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString();
}

/** Resolve verified grand total from site-data. */
export function getVerifiedDownloadTotal(data: SiteData): number | null {
  if (data.downloads?.verified !== true) return null;
  const total = data.downloads.displayTotal ?? data.downloads.total;
  return total ?? null;
}

/** Build donut/list channel slices that sum to the verified grand total. */
export function buildDownloadChannelSlices(data: SiteData): DownloadChannelSlice[] {
  const breakdown = data.downloads?.breakdown;
  const verified = data.downloads?.verified === true;

  if (!verified) {
    return [];
  }

  return [
    {
      id: "ovsx-canonical",
      label: "Open VSX (lorapok-labs)",
      count: breakdown?.openVsxCanonical ?? data.ovsx.downloadCount ?? 0,
      inTotal: true,
    },
    {
      id: "ovsx-duplicate",
      label: "Open VSX (LorapokLabs)",
      count: breakdown?.openVsxDuplicate ?? data.ovsxDuplicate?.downloadCount ?? 0,
      inTotal: true,
    },
    {
      id: "vscode",
      label: "VS Code Marketplace",
      count: breakdown?.vscodeMarketplace ?? data.vscode.downloadCount ?? 0,
      inTotal: true,
    },
    {
      id: "github",
      label: "GitHub releases",
      count: breakdown?.githubAllAssets ?? data.github.totalReleaseDownloads ?? 0,
      inTotal: true,
    },
  ].filter((slice) => slice.count > 0 || slice.id === "vscode" || slice.id === "github");
}

/** Prefer live VS Code downloadCount; never fall back to installCount. */
export function resolveVsCodeDownloadCount(data: SiteData): number | null {
  const fromBreakdown = data.downloads?.breakdown?.vscodeMarketplace;
  if (fromBreakdown != null) return fromBreakdown;
  return data.vscode.downloadCount ?? null;
}
