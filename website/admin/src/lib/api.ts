import { auth } from "./firebase";
import type { DevNotice } from "./site-data";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function authHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function apiGet<T>(path: string, authRequired = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (authRequired) Object.assign(headers, await authHeaders());
  const res = await fetch(`${API_BASE}${path}`, { headers });
  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API ${path} returned invalid JSON — is the dev server running?`);
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `API ${path} failed`);
  return data;
}

export async function fetchTags() {
  return apiGet<{ tags: string[]; source?: string; warning?: string }>("/tags");
}

export async function fetchHealth() {
  return apiGet<{
    ok: boolean;
    checks: { github: boolean; timestamp: string };
    firebaseProject?: string;
    mailConfigured?: boolean;
    mailTransport?: string;
    mailHint?: string;
  }>("/health", false);
}

export async function fetchReleases() {
  return apiGet<{ releases: Release[] }>("/releases");
}

export async function fetchWorkflowRuns() {
  return apiGet<{ runs: WorkflowRun[]; total: number }>("/workflows/runs");
}

export async function fetchMarketplaceSync() {
  return apiGet<MarketplaceSync>("/marketplace/sync");
}

export async function fetchDiscussionsApi() {
  return apiGet<DiscussionResponse>("/discussions");
}

export async function createDiscussionApi(payload: {
  title: string;
  body: string;
  categoryId: string;
  repositoryId?: string;
}) {
  const res = await fetch(`${API_BASE}/discussions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create discussion");
  return data as { ok: boolean; discussion: { id: string; url: string; title: string } | null };
}

export async function fetchUsageStatsApi() {
  return apiGet<UsageStatsResponse>("/usage/stats");
}

export async function fetchAnalyticsStatsApi() {
  return apiGet<{
    websiteVisits: number;
    packageClicks: Record<string, number>;
    totalEngagement: number;
    updatedAt: string | null;
    source?: string;
  }>("/analytics/stats", false);
}

export async function fetchCommunityConfigApi() {
  return apiGet<CommunityConfig>("/community/config", false);
}

export async function putCommunityConfigApi(payload: Partial<CommunityConfig>) {
  const res = await fetch(`${API_BASE}/community/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to save community config");
  return data as { ok: boolean; config: CommunityConfig };
}

export type DeployRequest = {
  target_tag: string;
  publish_market: "Both" | "Open VSX" | "VS Code Marketplace";
  release_channel: "Production" | "Beta (Pre-release)";
};

export type Release = {
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  prerelease: boolean;
  draft: boolean;
  vsix: { name: string; browser_download_url: string; download_count: number } | null;
};

export type WorkflowRun = {
  id: number;
  name: string;
  workflow: string;
  status: string;
  conclusion: string | null;
  url: string;
  branch: string;
  event: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceSync = {
  packageVersion: string;
  syncStatus: string;
  channels: Array<{
    id: string;
    label: string;
    version: string | null;
    downloadCount?: number;
    synced: boolean;
    warn?: boolean;
  }>;
  checkedAt: string;
};

export type DiscussionCategory = {
  id: string;
  name: string;
  slug: string;
  emoji?: string;
  description?: string;
  isAnswerable?: boolean;
  format?: "qa" | "announcement" | "discussion" | string;
};

export type DiscussionCapabilities = {
  canCreatePosts: boolean;
  canManageCategories: boolean;
  canCreatePolls: boolean;
  tokenConfigured: boolean;
};

export type DiscussionItem = {
  id?: string;
  title: string;
  url: string;
  category: string;
  categorySlug?: string;
  createdAt: string;
  comments: number;
  answered?: boolean;
  hasPoll?: boolean;
};

export type DiscussionResponse = {
  enabled: boolean;
  discussions: DiscussionItem[];
  categories: DiscussionCategory[];
  repositoryId?: string | null;
  topics: Array<{
    topic: string;
    count: number;
    items: Array<{ title: string; url: string; state?: string; comments?: number; updatedAt?: string }>;
  }>;
  settingsUrl: string;
  manageCategoriesUrl?: string;
  discussionsUrl?: string;
  repoIssuesUrl: string;
  capabilities?: DiscussionCapabilities;
};

export type UsageStatsResponse = {
  optInUniques: {
    unique1h: number;
    unique24h: number;
    unique7d: number;
    unique30d: number;
    uniqueAll: number;
    byOs?: Record<string, number>;
    byHost?: Record<string, number>;
  };
  marketplace?: {
    total?: number;
    breakdown?: Record<string, number>;
    note?: string;
  } | null;
  visitors?: {
    websiteVisits?: number;
    totalEngagement?: number;
    packageClicks?: Record<string, number>;
    updatedAt?: string | null;
  } | null;
  updatedAt: string;
};

export type CommunityConfig = {
  featuredDiscussionUrls: string[];
  defaultCategorySlug: string;
  issueTopicLabelMap?: Record<string, string>;
  collaborateUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function syncAdminAccess(payload: { email: string; action: "add" | "remove" }) {
  const res = await fetch(`${API_BASE}/admins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Admin sync failed");
  return data;
}

export async function triggerDeployment(payload: DeployRequest) {
  const res = await fetch(`${API_BASE}/deploy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Deployment trigger failed");
  }

  return res.json();
}

export type NoticePayload = Partial<DevNotice> & { enabled: boolean };

export type ApiActivityEntry = {
  id?: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  email?: string;
};

export type ApiActivityResponse = {
  items?: ApiActivityEntry[];
  entries?: ApiActivityEntry[];
  page: number;
  limit: number;
  total: number;
};

export type ApiProbeResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  body: string;
};

export async function probeApiEndpoint(
  path: string,
  method: string,
  options?: { auth?: boolean; body?: string }
): Promise<ApiProbeResult> {
  const started = performance.now();
  const headers: Record<string, string> = {};
  if (options?.auth) {
    Object.assign(headers, await authHeaders());
  }
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: options?.body,
  });

  const text = await res.text();
  const latencyMs = Math.round(performance.now() - started);
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    /* keep raw text */
  }
  if (body.length > 6000) {
    body = `${body.slice(0, 6000)}\n… (truncated)`;
  }

  return { ok: res.ok, status: res.status, latencyMs, body };
}

function asNotice(data: unknown): DevNotice | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const nested = raw.notice;
  const notice = (nested && typeof nested === "object" ? nested : raw) as Partial<DevNotice>;
  if (!notice.title && notice.enabled !== true && notice.enabled !== false) return null;
  return notice as DevNotice;
}

export async function fetchNotice() {
  const data = await apiGet<DevNotice | { notice: DevNotice | null }>("/notice", false);
  return { notice: asNotice(data) };
}

export async function fetchNotices() {
  return apiGet<{ items: DevNotice[]; active: DevNotice | null }>("/notices");
}

export async function createNotice(payload: NoticePayload & { enabled?: boolean }) {
  const res = await fetch(`${API_BASE}/notices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to create notice");
  return data as { ok: boolean; notice: DevNotice; items: DevNotice[] };
}

export async function updateNotice(payload: Partial<DevNotice> & { id: string }) {
  const res = await fetch(`${API_BASE}/notices`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to update notice");
  return data as { ok: boolean; notice: DevNotice; items: DevNotice[] };
}

export async function deleteNotice(id: string) {
  const res = await fetch(`${API_BASE}/notices?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to delete notice");
  return data as { ok: boolean; items: DevNotice[] };
}

export async function saveNotice(payload: NoticePayload) {
  const res = await fetch(`${API_BASE}/notice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to save notice");
  return data;
}

export async function clearNotice() {
  const res = await fetch(`${API_BASE}/notice`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to clear notice");
  return data;
}

export async function subscribeEmail(email: string) {
  const res = await fetch(`${API_BASE}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Subscribe failed");
  return data;
}

export async function fetchApiActivity(page = 1, limit = 25) {
  const data = await apiGet<ApiActivityResponse>(`/activity?page=${page}&limit=${limit}`);
  return {
    ...data,
    entries: data.items ?? data.entries ?? [],
  };
}

export async function triggerRollback(payload: DeployRequest) {
  const res = await fetch(`${API_BASE}/rollback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Rollback trigger failed");
  return data;
}

export async function inviteAdminEmail(email: string) {
  const res = await fetch(`${API_BASE}/admins/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Invite failed");
  return data;
}
