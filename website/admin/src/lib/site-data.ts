export interface DownloadBreakdown {
  openVsxCanonical: number;
  openVsxDuplicate: number;
  vscodeMarketplace: number;
  githubAllAssets: number;
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
    tags?: string[];
    vsixDownloadCount?: number;
    totalReleaseDownloads?: number;
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
