import { auth } from "./firebase";

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
  return apiGet<{ tags: string[] }>("/tags");
}

export async function fetchHealth() {
  return apiGet<{ ok: boolean; checks: { github: boolean; timestamp: string }; firebaseProject?: string }>("/health", false);
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

export type DiscussionResponse = {
  enabled: boolean;
  discussions: Array<{ title: string; url: string; category: string; createdAt: string; comments: number }>;
  topics: Array<{ topic: string; count: number; items: Array<{ title: string; url: string; state?: string }> }>;
  settingsUrl: string;
  repoIssuesUrl: string;
};

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
