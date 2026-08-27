export const COMMUNITY_DOWNLOADS_SITE_DATA_URL = "https://cursor.lorapok.tech/site-data.json";

export const COMMUNITY_DOWNLOADS_NOTE =
  "Grand total sums all live marketplace channels (Open VSX canonical + LorapokLabs duplicate + VS Code downloadCount + GitHub release assets).";

export interface CommunityDownloadBreakdown {
  openVsxCanonical: number | null;
  openVsxDuplicate: number | null;
  vscodeMarketplace: number | null;
  githubAllAssets: number | null;
}

export interface CommunityDownloadStats {
  verified: boolean;
  total: number | null;
  openVsxCombined: number | null;
  breakdown: CommunityDownloadBreakdown;
  note: string;
}

function parseCount(value: unknown): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/** Normalize download stats from a site-data.json payload. */
export function parseCommunityDownloadsFromSiteData(data: unknown): CommunityDownloadStats {
  const root = data as Record<string, unknown> | null | undefined;
  const downloads = root?.downloads as Record<string, unknown> | undefined;
  const breakdown = (downloads?.breakdown ?? {}) as Record<string, unknown>;
  const verified = downloads?.verified === true;

  const ovsx = root?.ovsx as Record<string, unknown> | undefined;
  const ovsxDuplicate = root?.ovsxDuplicate as Record<string, unknown> | undefined;
  const vscode = root?.vscode as Record<string, unknown> | undefined;
  const github = root?.github as Record<string, unknown> | undefined;

  const canonical = parseCount(breakdown.openVsxCanonical ?? ovsx?.downloadCount);
  const duplicate = parseCount(breakdown.openVsxDuplicate ?? ovsxDuplicate?.downloadCount);
  const vscodeMarketplace = parseCount(breakdown.vscodeMarketplace ?? vscode?.downloadCount);
  const githubAllAssets = parseCount(breakdown.githubAllAssets ?? github?.totalReleaseDownloads);

  const openVsxCombined = verified
    ? parseCount(downloads?.openVsxCombined) ??
      (canonical != null && duplicate != null ? canonical + duplicate : canonical)
    : null;

  const total = verified ? parseCount(downloads?.displayTotal ?? downloads?.total) : null;

  return {
    verified,
    total,
    openVsxCombined,
    breakdown: {
      openVsxCanonical: canonical,
      openVsxDuplicate: duplicate,
      vscodeMarketplace,
      githubAllAssets,
    },
    note: String(downloads?.note ?? COMMUNITY_DOWNLOADS_NOTE),
  };
}

export function formatCommunityCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString();
}

export function formatCommunityDownloadsHeadline(stats: CommunityDownloadStats): string {
  if (!stats.verified || stats.total == null) return "Community downloads unavailable";
  return `${formatCommunityCount(stats.total)} total downloads`;
}

export function formatCommunityDownloadsBreakdown(stats: CommunityDownloadStats): string {
  if (!stats.verified) return "Live marketplace stats unavailable";
  const parts = [
    `Open VSX ${formatCommunityCount(stats.openVsxCombined)}`,
    stats.breakdown.vscodeMarketplace != null
      ? `VS Code ${formatCommunityCount(stats.breakdown.vscodeMarketplace)}`
      : null,
    stats.breakdown.githubAllAssets != null
      ? `GitHub ${formatCommunityCount(stats.breakdown.githubAllAssets)}`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
