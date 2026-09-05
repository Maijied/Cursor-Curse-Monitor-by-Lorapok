export interface DownloadBreakdown {
  openVsxCanonical: number | null;
  openVsxDuplicate: number | null;
  openVsxDisplay?: number | null;
  vscodeMarketplace: number | null;
  githubAllAssets: number | null;
  githubVsix: number | null;
  latestReleaseVsix: number | null;
}

export interface VisitorStats {
  websiteVisits: number;
  packageClicks: {
    ovsx: number;
    vscode: number;
    github: number;
    vsix: number;
    npm?: number;
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

export interface StableFallbackVersion {
  tag: string;
  version: string;
  stability: "stable" | "unsafe" | "legacy" | "unknown" | string;
  recommended: boolean;
  vsixUrl: string;
  note: string;
}

export interface StableFallbackInfo {
  safeSinceVersion: string;
  recommendedVersion: string;
  model: {
    displayName: string;
    modelId: string;
    description: string;
  };
  versions: StableFallbackVersion[];
}

export interface DevNotice {
  enabled: boolean;
  type: string;
  severity: "info" | "warning" | "critical" | string;
  title: string;
  message: string;
  shortMessage: string;
  feedbackUrl: string;
  collaborateUrl: string;
  updatedAt: string;
  dismissible: boolean;
  id?: string | null;
  source?: "generated" | "admin" | string;
}

export interface SiteData {
  generatedAt: string;
  version: string;
  packageVersion: string;
  syncStatus: "synced" | "drift" | "duplicate-listing" | "ahead" | "missing" | string;
  notice?: DevNotice;
  noticeTemplates?: Array<{ templateId: string; label: string; category: string; severity: string; type: string }>;
  mailTemplates?: Array<{ id: string; label: string; category: string; subject: string }>;
  productContext?: {
    version: string;
    homepage: string;
    supportEmail: string;
    productEmail: string;
    releaseUrl: string;
  };
  company?: {
    name: string;
    supportEmail?: string;
    productEmail?: string;
    website?: string;
    adminUrl?: string;
  };
  stableFallback?: StableFallbackInfo;
  downloads?: {
    total: number | null;
    displayTotal?: number | null;
    verified?: boolean;
    liveSources?: {
      openVsxCanonical?: boolean;
      openVsxDuplicate?: boolean;
      vscodeMarketplace?: boolean;
      githubReleases?: boolean;
    };
    canonicalTotal?: number | null;
    openVsxCombined?: number | null;
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
  githubCommunity?: {
    lastUpdated?: string;
    stars?: number | null;
    forks?: number | null;
    openIssues?: number | null;
    traffic?: {
      periodDays?: number;
      clones?: { total?: number; unique?: number };
      views?: { total?: number; unique?: number };
    };
    ci?: {
      avgJobRunSeconds?: number;
      avgQueueSeconds?: number;
      jobFailureRatePercent?: number;
      workflows?: Array<{
        name: string;
        failureRatePercent?: number;
        avgRunTime?: string;
        runs?: number;
      }>;
    };
    project?: {
      number?: number;
      url?: string;
      title?: string;
      openPullRequests?: number | null;
    };
  };
  ovsx: { version: string | null; url: string; namespace?: string; downloadCount?: number };
  ovsxDuplicate?: { version: string | null; url: string; namespace?: string; downloadCount?: number };
  vscode: { version: string | null; installCount?: number; downloadCount?: number; url: string };
  github: {
    releaseTag: string;
    releaseUrl: string;
    publishedAt: string | null;
    tags?: string[];
    vsixDownloadCount?: number;
    totalReleaseDownloads?: number;
    allAssetsDownloadCount?: number;
    chromeZipUrl?: string | null;
    chromeZipName?: string | null;
  };
  browserExtension?: {
    version: string | null;
    firefox?: {
      url: string;
      published: boolean;
      reviewStatus?: string;
      version?: string | null;
      downloadCount?: number;
    };
    chrome?: { zipUrl: string | null; zipName?: string | null; webStorePublished: boolean };
  };
}

export function syncStatusLabel(status: string): string {
  switch (status) {
    case "synced": return "Synced";
    case "drift": return "Drift";
    case "dual-listing":
    case "duplicate-listing":
      return "Dual Open VSX listings";
    case "ahead": return "Ahead";
    case "release-candidate": return "Release candidate";
    case "missing": return "Missing";
    default: return status;
  }
}

export function formatCount(n: number | undefined | null): string {
  if (n == null) return "0";
  return n.toLocaleString();
}

/** Root package.json stays at 0.0.0 in git; resolved release version lives in `version`. */
export function resolvePackageVersion(data: Pick<SiteData, "packageVersion" | "version">): string {
  const pkg = String(data.packageVersion ?? "").replace(/^v/, "");
  const version = String(data.version ?? "").replace(/^v/, "");
  if (pkg && pkg !== "0.0.0") return pkg;
  return version || pkg;
}

export function normalizeSiteData(data: SiteData): SiteData {
  const packageVersion = resolvePackageVersion(data);
  return packageVersion === data.packageVersion ? data : { ...data, packageVersion };
}
