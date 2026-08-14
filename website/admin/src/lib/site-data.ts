export interface DownloadBreakdown {
  openVsxCanonical: number;
  openVsxDuplicate: number;
  vscodeMarketplace: number;
  githubVsix: number;
  latestReleaseVsix: number;
}

export interface VisitorStats {
  websiteVisits: number;
  packageClicks: {
    ovsx: number;
    vscode: number;
    github: number;
    vsix: number;
    openvsxDuplicate?: number;
  };
  totalEngagement: number;
  updatedAt: string | null;
}

export interface CommunityTopic {
  topic: string;
  count: number;
  items: Array<{
    title: string;
    url: string;
    state?: string;
    comments?: number;
    updatedAt?: string;
  }>;
}

export interface SiteData {
  generatedAt: string;
  version: string;
  packageVersion: string;
  syncStatus: "synced" | "drift" | "duplicate-listing" | "ahead" | "missing" | string;
  downloads?: {
    total: number;
    breakdown: DownloadBreakdown;
    note?: string;
  };
  visitors?: VisitorStats;
  community?: {
    discussionsEnabled: boolean;
    discussions: Array<{
      title: string;
      url: string;
      category: string;
      createdAt: string;
      comments: number;
      answered?: boolean;
    }>;
    topics: CommunityTopic[];
    settingsUrl: string;
    repoIssuesUrl: string;
  };
  ovsx: { version: string | null; url: string; namespace?: string; downloadCount?: number };
  ovsxDuplicate?: { version: string | null; url: string; namespace?: string; downloadCount?: number };
  vscode: { version: string | null; installCount?: number; downloadCount?: number; url: string };
  github: {
    releaseTag: string;
    releaseUrl: string;
    publishedAt: string | null;
    vsixDownloadCount?: number;
    totalReleaseDownloads?: number;
  };
}

export function syncStatusLabel(status: string): string {
  switch (status) {
    case "synced": return "Synced";
    case "drift": return "Drift";
    case "duplicate-listing": return "Duplicate listing";
    case "ahead": return "Ahead";
    case "missing": return "Missing";
    default: return status;
  }
}

export function formatCount(n: number | undefined | null): string {
  if (n == null) return "0";
  return n.toLocaleString();
}
