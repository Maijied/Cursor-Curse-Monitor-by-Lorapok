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

/** True when UI can show marketplace download numbers (fully verified or partial breakdown). */
export function isDownloadStatsDisplayable(data: SiteData): boolean {
  return isDownloadStatsVerified(data) || hasDownloadBreakdown(data);
}

function hasDownloadBreakdown(data: SiteData): boolean {
  const breakdown = data.downloads?.breakdown;
  if (!breakdown) return false;
  return (
    breakdown.openVsxCanonical != null ||
    breakdown.openVsxDuplicate != null ||
    breakdown.vscodeMarketplace != null ||
    breakdown.githubAllAssets != null
  );
}

function channelCountFromData(data: SiteData, channel: DownloadChannelKey): number | null {
  const breakdown = data.downloads?.breakdown;
  switch (channel) {
    case "openVsxCanonical":
      return breakdown?.openVsxCanonical ?? data.ovsx?.downloadCount ?? null;
    case "openVsxDuplicate":
      return breakdown?.openVsxDuplicate ?? data.ovsxDuplicate?.downloadCount ?? null;
    case "vscodeMarketplace":
      return breakdown?.vscodeMarketplace ?? data.vscode?.downloadCount ?? null;
    case "githubAllAssets":
      if (breakdown != null && "githubAllAssets" in breakdown) {
        return breakdown.githubAllAssets ?? null;
      }
      return (
        data.github?.totalReleaseDownloads ??
        data.github?.allAssetsDownloadCount ??
        null
      );
    default:
      return null;
  }
}

/** Resolve verified grand total from site-data. */
export function getVerifiedDownloadTotal(data: SiteData): number | null {
  if (!isDownloadStatsVerified(data)) return null;
  const total = data.downloads?.displayTotal ?? data.downloads?.total;
  return total ?? null;
}

/**
 * Grand total for Mission Control — verified live total, or sum of available
 * marketplace channels when GitHub release aggregation is temporarily missing.
 */
export function getDisplayDownloadTotal(data: SiteData): number | null {
  const verifiedTotal = getVerifiedDownloadTotal(data);
  if (verifiedTotal != null) return verifiedTotal;
  if (!hasDownloadBreakdown(data)) return null;

  const canonical = channelCountFromData(data, "openVsxCanonical") ?? 0;
  const duplicate = channelCountFromData(data, "openVsxDuplicate") ?? 0;
  const vscode = channelCountFromData(data, "vscodeMarketplace") ?? 0;
  const github = channelCountFromData(data, "githubAllAssets") ?? 0;
  return canonical + duplicate + vscode + github;
}

/**
 * Per-channel download count for dashboards. Fail-closed when no channel data exists.
 */
export function getVerifiedChannelCount(data: SiteData, channel: DownloadChannelKey): number | null {
  if (!isDownloadStatsDisplayable(data)) return null;
  return channelCountFromData(data, channel);
}

/** User-facing hint when downloads are partial vs fully verified. */
export function downloadStatsAvailabilityLabel(data: SiteData): string {
  if (isDownloadStatsVerified(data)) {
    return "Open VSX (both namespaces) + VS Code + GitHub";
  }
  if (isDownloadStatsDisplayable(data)) {
    return "Marketplace channels live · GitHub may be pending";
  }
  return "Live marketplace stats unavailable";
}

/** Build donut/list channel slices for charts. */
export function buildDownloadChannelSlices(data: SiteData): DownloadChannelSlice[] {
  if (!isDownloadStatsDisplayable(data)) {
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
