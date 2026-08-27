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

export type DownloadChannelKey =
  | "openVsxCanonical"
  | "openVsxDuplicate"
  | "vscodeMarketplace"
  | "githubAllAssets";

/** True only when every download channel was read live from its registry. */
export function isDownloadStatsVerified(data: SiteData): boolean {
  return data.downloads?.verified === true;
}

/** Resolve verified grand total from site-data. */
export function getVerifiedDownloadTotal(data: SiteData): number | null {
  if (!isDownloadStatsVerified(data)) return null;
  const total = data.downloads?.displayTotal ?? data.downloads?.total;
  return total ?? null;
}

/**
 * Per-channel download count. Fail-closed: returns null unless marketplace
 * stats are verified, so callers render an em dash instead of a stale count.
 */
export function getVerifiedChannelCount(data: SiteData, channel: DownloadChannelKey): number | null {
  if (!isDownloadStatsVerified(data)) return null;
  const breakdown = data.downloads?.breakdown;
  switch (channel) {
    case "openVsxCanonical":
      return breakdown?.openVsxCanonical ?? data.ovsx.downloadCount ?? null;
    case "openVsxDuplicate":
      return breakdown?.openVsxDuplicate ?? data.ovsxDuplicate?.downloadCount ?? null;
    case "vscodeMarketplace":
      return breakdown?.vscodeMarketplace ?? data.vscode.downloadCount ?? null;
    case "githubAllAssets":
      return breakdown?.githubAllAssets ?? data.github.totalReleaseDownloads ?? null;
    default:
      return null;
  }
}

/** Build donut/list channel slices that sum to the verified grand total. */
export function buildDownloadChannelSlices(data: SiteData): DownloadChannelSlice[] {
  if (!isDownloadStatsVerified(data)) {
    return [];
  }

  return [
    { id: "ovsx-canonical", label: "Open VSX (lorapok-labs)", key: "openVsxCanonical" as const },
    { id: "ovsx-duplicate", label: "Open VSX (LorapokLabs)", key: "openVsxDuplicate" as const },
    { id: "vscode", label: "VS Code Marketplace", key: "vscodeMarketplace" as const },
    { id: "github", label: "GitHub releases", key: "githubAllAssets" as const },
  ]
    .map(({ id, label, key }) => ({
      id,
      label,
      count: getVerifiedChannelCount(data, key) ?? 0,
      inTotal: true,
    }))
    .filter((slice) => slice.count > 0 || slice.id === "vscode" || slice.id === "github");
}

