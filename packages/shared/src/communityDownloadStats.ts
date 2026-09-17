export const COMMUNITY_DOWNLOADS_SITE_DATA_URL = "https://cursor.lorapok.tech/site-data.json";

export const COMMUNITY_DOWNLOADS_NOTE =
  "Grand total sums Open VSX (canonical + LorapokLabs) + VS Code downloadCount + GitHub release assets (+ Firefox AMO lifetime when exposed). AMO weekly downloads and average daily users are listed separately — https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor/";

export interface CommunityDownloadBreakdown {
  openVsxCanonical: number | null;
  openVsxDuplicate: number | null;
  vscodeMarketplace: number | null;
  githubAllAssets: number | null;
  githubVsix?: number | null;
  githubChrome?: number | null;
  latestReleaseVsix?: number | null;
  latestReleaseChrome?: number | null;
  firefoxAmoWeekly?: number | null;
  firefoxAmoDailyUsers?: number | null;
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
  const githubVsix = parseCount(breakdown.githubVsix);
  const githubChrome = parseCount(breakdown.githubChrome);
  const latestReleaseVsix = parseCount(breakdown.latestReleaseVsix);
  const latestReleaseChrome = parseCount(breakdown.latestReleaseChrome);
  const firefoxAmoWeekly = parseCount(breakdown.firefoxAmoWeekly);
  const firefoxAmoDailyUsers = parseCount(breakdown.firefoxAmoDailyUsers);

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
      githubVsix,
      githubChrome,
      latestReleaseVsix,
      latestReleaseChrome,
      firefoxAmoWeekly,
      firefoxAmoDailyUsers,
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
    stats.breakdown.firefoxAmoWeekly != null || stats.breakdown.firefoxAmoDailyUsers != null
      ? `Firefox ${formatCommunityCount(stats.breakdown.firefoxAmoWeekly)}/wk`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
