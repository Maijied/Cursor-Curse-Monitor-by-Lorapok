import { auth } from "./firebase";
import type { DevNotice } from "./site-data";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export function parseApiResponse<T>(text: string, ok: boolean, path: string): T {
  let data: T & { error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API ${path} returned invalid JSON — is the dev server running?`);
  }
  if (!ok) throw new Error(data.error || `API ${path} failed`);
  return data;
}

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
  return parseApiResponse<T>(text, res.ok, path);
}

export async function fetchTags() {
  return apiGet<{
    tags: string[];
    liveTag: string | null;
    latestTag: string | null;
    suggestedTag: string | null;
    source?: string;
    warning?: string;
  }>("/tags");
}

/**
 * Retrieves the API health status and service configuration indicators.
 *
 * @returns The health status, service checks, and optional configuration details.
 */
export async function fetchHealth() {
  return apiGet<{
    ok: boolean;
    checks: { github: boolean; timestamp: string };
    firebaseProject?: string;
    mailConfigured?: boolean;
    mailTransport?: string;
    mailRelayBound?: boolean;
    mailRestConfigured?: boolean;
    mailResendConfigured?: boolean;
    mailHint?: string;
    adminPublicUrl?: string;
    githubTokenConfigured?: boolean;
    discordConfigured?: boolean;
    statsRefreshEnabled?: boolean;
    statsRefreshIntervalMinutes?: number;
    statsRefreshLastRunAt?: string | null;
    discordDigestEnabled?: boolean;
    discordDigestIntervalMinutes?: number;
    discordDigestLastRunAt?: string | null;
    cronSecretConfigured?: boolean;
  }>("/health", false);
}

export async function fetchReleases() {
  return apiGet<{ releases: Release[] }>("/releases");
}

export async function fetchWorkflowRuns() {
  return apiGet<{ runs: WorkflowRun[]; total: number }>("/workflows/runs");
}

export async function fetchWorkflowRunLogs(runId: number | string) {
  return apiGet<WorkflowRunLogs>(`/workflows/run-logs?run_id=${encodeURIComponent(String(runId))}`);
}

export async function fetchMarketplaceSync() {
  return apiGet<MarketplaceSync>("/marketplace/sync");
}

export async function fetchVersionPlan(
  bump: "patch" | "minor" | "major" = "patch",
  mode: "release" | "rollback" = "release",
) {
  return apiGet<VersionPlan>(
    `/version/plan?bump=${encodeURIComponent(bump)}&mode=${encodeURIComponent(mode)}`,
  );
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

/**
 * Saves updated community configuration.
 *
 * @param payload - The community configuration fields to update
 * @returns The update status and saved community configuration
 */
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

export type StatsRefreshConfig = {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  lastError: string | null;
  lastDurationMs: number | null;
  lastTriggeredBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type DiscordDigestConfig = StatsRefreshConfig & {
  refreshBeforeSend: boolean;
  includeChangelog: boolean;
};

export type StatsRefreshCacheSummary = {
  refreshedAt: string;
  displayTotal: number | null;
  verified: boolean;
  syncStatus: string | null;
} | null;

export type GithubCronJobMeta = {
  id: string;
  label: string;
  description: string;
  schedule: string;
  scheduleLabel: string;
  workflow: string;
  editable: false;
};

export type CronJobsConfigResponse = {
  ok: boolean;
  githubJobs: GithubCronJobMeta[];
  managedJobs: Array<{
    id: string;
    label: string;
    description: string;
    workerEndpoint: string;
    intervalMin: number;
    intervalMax: number;
    intervalDefault: number;
    intervalUnit: string;
  }>;
  statsRefresh: StatsRefreshConfig;
  discordDigest: DiscordDigestConfig;
  cache: StatsRefreshCacheSummary;
};

/** @deprecated Use fetchCronJobsConfigApi */
export async function fetchStatsRefreshConfigApi() {
  const data = await fetchCronJobsConfigApi();
  return { ok: data.ok, config: data.statsRefresh, cache: data.cache };
}

/** @deprecated Use putCronJobsConfigApi */
export async function putStatsRefreshConfigApi(payload: {
  enabled?: boolean;
  intervalMinutes?: number;
}) {
  const result = await putCronJobsConfigApi({ statsRefresh: payload });
  return { ok: result.ok, config: result.statsRefresh };
}

export async function fetchCronJobsConfigApi() {
  return apiGet<CronJobsConfigResponse>("/integrations/cron-jobs/config");
}

export async function putCronJobsConfigApi(payload: {
  statsRefresh?: { enabled?: boolean; intervalMinutes?: number };
  discordDigest?: {
    enabled?: boolean;
    intervalMinutes?: number;
    refreshBeforeSend?: boolean;
    includeChangelog?: boolean;
  };
}) {
  const res = await fetch(`${API_BASE}/integrations/cron-jobs/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to save cron settings");
  return data as {
    ok: boolean;
    statsRefresh: StatsRefreshConfig;
    discordDigest: DiscordDigestConfig;
  };
}

export async function sendDiscordDigestTestApi() {
  const res = await fetch(`${API_BASE}/integrations/discord/digest/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Discord digest failed");
  return data as {
    ok: boolean;
    durationMs?: number;
    displayTotal?: number | null;
    syncStatus?: string | null;
  };
}

/**
 * Triggers an immediate statistics refresh.
 */
export async function refreshStatsNowApi() {
  const res = await fetch(`${API_BASE}/stats/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Stats refresh failed");
  return data as {
    ok: boolean;
    durationMs?: number;
    refreshedAt?: string;
    displayTotal?: number | null;
    syncStatus?: string | null;
  };
}

export type DiscordConfig = {
  deploymentConfigured: boolean;
  feedbackConfigured: boolean;
  communityConfigured: boolean;
  deploymentWebhookPreview: string | null;
  feedbackWebhookPreview: string | null;
  communityWebhookPreview: string | null;
  /** @deprecated use deploymentConfigured */
  configured: boolean;
  /** @deprecated use deploymentWebhookPreview */
  webhookPreview: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * Retrieves the configured Discord integration settings.
 *
 * @returns The Discord configuration response
 */
export async function fetchDiscordConfigApi() {
  return apiGet<{ ok: boolean; config: DiscordConfig }>("/integrations/discord/config");
}

/**
 * Saves the Discord deployment and feedback webhook configuration.
 *
 * @param payload - Webhook URLs to save; `webhookUrl` is retained for backward compatibility.
 * @returns The save status and resulting Discord configuration.
 */
export async function putDiscordConfigApi(payload: {
  deploymentWebhookUrl?: string;
  feedbackWebhookUrl?: string;
  communityWebhookUrl?: string;
  /** @deprecated use deploymentWebhookUrl */
  webhookUrl?: string;
}) {
  const res = await fetch(`${API_BASE}/integrations/discord/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to save Discord webhook");
  return data as { ok: boolean; config: DiscordConfig };
}

/**
 * Sends deployment details to the configured Discord integration.
 *
 * @param payload - Deployment information to include in the notification
 * @returns The notification result, including whether it was skipped
 * @throws {Error} If the notification fails and the response is not marked as skipped
 */
export async function notifyDiscordDeploymentApi(payload: {
  actionType?: string;
  tag?: string;
  channel?: string;
  market?: string;
  conclusion?: string;
  runUrl?: string;
  summary?: string;
  jobs?: Array<{ name: string; status?: string; conclusion?: string }>;
}) {
  const res = await fetch(`${API_BASE}/integrations/discord/deployment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.skipped) throw new Error(data.error || "Discord notification failed");
  return data as { ok: boolean; skipped?: boolean };
}

/** Sends a sample user-feedback card to the feedback Discord webhook. */
export async function notifyDiscordFeedbackApi(payload?: { summary?: string }) {
  const res = await fetch(`${API_BASE}/integrations/discord/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.skipped) throw new Error(data.error || "Discord feedback notification failed");
  return data as { ok: boolean; skipped?: boolean };
}

/** Sends a sample community post to the community Discord webhook. */
export async function notifyDiscordCommunityApi(payload?: { summary?: string }) {
  const res = await fetch(`${API_BASE}/integrations/discord/community`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.skipped) throw new Error(data.error || "Discord community notification failed");
  return data as { ok: boolean; skipped?: boolean };
}

export type SubscribePromptConfig = {
  subscribeModalEnabled: boolean;
  requireMailForSubscribe: boolean;
  subscribeFallbackDiscordUrl: string;
  subscribeFallbackMode: "discord" | "hidden";
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function fetchSubscribePromptConfigApi() {
  return apiGet<{ ok: boolean; config: SubscribePromptConfig }>("/integrations/subscribe/config");
}

export async function putSubscribePromptConfigApi(payload: Partial<SubscribePromptConfig>) {
  const res = await fetch(`${API_BASE}/integrations/subscribe/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to save subscribe prompt settings");
  return data as { ok: boolean; config: SubscribePromptConfig };
}

export type DeployRequest = {
  target_tag: string;
  publish_market: "Both" | "Open VSX + Firefox AMO" | "Open VSX" | "VS Code Marketplace" | "Firefox AMO";
  release_channel: "Production" | "Beta (Pre-release)";
  deploy_admin?: boolean;
  deploy_website?: boolean;
};

export type InfraDeployRequest = {
  deploy_admin?: boolean;
  deploy_website?: boolean;
};

export type ReleaseRequest = {
  version_type: "patch" | "minor" | "major" | "custom";
  custom_version?: string;
  publish_market: "Both" | "Open VSX + Firefox AMO" | "Open VSX" | "VS Code Marketplace" | "Firefox AMO";
  release_channel: "Production" | "Beta (Pre-release)";
  deploy_admin?: boolean;
  deploy_website?: boolean;
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

export type VersionPlanReason = {
  id: string;
  label: string;
  liveVersion: string | null;
  status: "missing" | "behind" | "synced" | "ahead" | "unknown" | "info";
  reason: string;
};

export type VersionPlan = MarketplaceSync & {
  bumpType: "patch" | "minor" | "major" | "rollback";
  planMode?: "release" | "rollback";
  packageVersion: string | null;
  maxLiveVersion: string | null;
  maxAllVersion: string | null;
  recommendedVersion: string | null;
  recommendedTag: string | null;
  needsBump: boolean;
  needsPublish: boolean;
  shouldCreateTag: boolean;
  shouldBumpPackage: boolean;
  tagAlreadyExists: boolean;
  allSynced: boolean;
  summary: string;
  reasons: VersionPlanReason[];
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
    activeNow: number;
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

export async function triggerInfraDeploy(payload: InfraDeployRequest = {}) {
  const res = await fetch(`${API_BASE}/deploy-infra`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Infra deployment trigger failed");
  }

  return res.json();
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

export async function triggerRelease(payload: ReleaseRequest) {
  const res = await fetch(`${API_BASE}/release`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Release trigger failed");
  return data;
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
    try {
      Object.assign(headers, await authHeaders());
    } catch {
      // In dev or preview, provide fallback admin identifier
      headers["X-Dev-Admin"] = "mdshuvo40@gmail.com";
    }
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

export type NoticeTemplate = DevNotice & { templateId: string; label: string; category: string };

export async function fetchNoticeTemplates() {
  return apiGet<{ templates: NoticeTemplate[] }>("/notices?templates=1");
}

export type MailTemplate = {
  id: string;
  label: string;
  category: string;
  subject: string;
  text: string;
  severity?: string;
  variables?: string[];
};

export async function fetchMailTemplates() {
  return apiGet<{ templates: MailTemplate[] }>("/mailbox?templates=1");
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

export async function subscribeEmail(email: string, source = "admin") {
  const res = await fetch(`${API_BASE}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source, consent: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Subscribe failed");
  return data;
}

export type SubscriberRecord = {
  email: string;
  subscribedAt: string;
  source: string;
  installId: string | null;
  consentVersion: string;
};

export async function fetchSubscribers() {
  return apiGet<{ items: SubscriberRecord[]; stats: { total: number; withInstallId: number; bySource: Record<string, number> } }>(
    "/subscribers"
  );
}

export async function broadcastToSubscribers(payload: {
  title: string;
  message: string;
  shortMessage?: string;
  severity?: string;
  feedbackUrl?: string;
}) {
  const res = await fetch(`${API_BASE}/subscribers/broadcast`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 207) {
    throw new Error(data.error || data.message || "Broadcast failed");
  }
  return data as {
    ok: boolean;
    sent: number;
    failed: number;
    total: number;
    message?: string;
  };
}

export type LogEntry = {
  id: string;
  type: "api" | "mail" | "system";
  ts: string;
  level: string;
  source: string;
  message?: string;
  method?: string;
  path?: string;
  status?: number | string;
  latencyMs?: number;
  email?: string | null;
  subject?: string;
  direction?: string;
  category?: string;
  error?: string | null;
};

export type MailboxMessage = {
  id: string;
  direction: "outbound" | "inbound";
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  status: string;
  category: string;
  ts: string;
  sentBy?: string | null;
  error?: string | null;
  read: boolean;
};

export type WorkflowRunLogs = {
  runId: number;
  jobs: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    startedAt?: string;
    completedAt?: string;
    steps?: Array<{ name: string; status: string; conclusion: string | null; number: number }>;
  }>;
  text: string;
  logsUnavailable?: boolean;
  logsHint?: string;
};

export async function fetchLogs(
  page = 1,
  limit = 25,
  filters: {
    type?: string;
    method?: string;
    status?: string;
    email?: string;
    q?: string;
    source?: string;
    level?: string;
  } = {}
) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.method) params.set("method", filters.method);
  if (filters.status) params.set("status", filters.status);
  if (filters.email) params.set("email", filters.email);
  if (filters.q) params.set("q", filters.q);
  if (filters.source) params.set("source", filters.source);
  if (filters.level) params.set("level", filters.level);
  return apiGet<{
    items: LogEntry[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    counts?: { api: number; mail: number; system: number };
  }>(`/logs?${params.toString()}`);
}

export async function fetchMailbox(
  page = 1,
  limit = 25,
  filters: {
    direction?: string;
    category?: string;
    status?: string;
    unread?: boolean;
    q?: string;
  } = {}
) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.unread) params.set("unread", "true");
  if (filters.q) params.set("q", filters.q);
  return apiGet<{
    items: MailboxMessage[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    stats: { total: number; unread: number; outbound: number; inbound: number; failed: number };
    transport: { configured: boolean; transport: string; hint?: string };
  }>(`/mailbox?${params.toString()}`);
}

export async function sendMailboxMessage(payload: {
  to: string;
  subject: string;
  text: string;
  category?: string;
}) {
  const res = await fetch(`${API_BASE}/mailbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action: "send", ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Send failed");
  return data as { ok: boolean; message?: string };
}

export async function sendMailboxTest(to?: string) {
  const res = await fetch(`${API_BASE}/mailbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action: "test", to }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Test failed");
  return data as { ok: boolean; message?: string; transport?: string; reason?: string };
}

export async function syncMailTransport() {
  const res = await fetch(`${API_BASE}/integrations/mail/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Mail sync failed");
  return data as {
    ok: boolean;
    message?: string;
    recommendations?: string[];
    transport?: { configured: boolean; transport: string; relayBound?: boolean; resendConfigured?: boolean };
  };
}

export async function startMailboxTestmailProbe() {
  const res = await fetch(`${API_BASE}/mailbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action: "testmail-probe" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Testmail probe failed");
  return data as {
    ok: boolean;
    tag?: string;
    to?: string;
    since?: number;
    transport?: string;
    message?: string;
    reason?: string;
  };
}

export async function pollTestmailInbox(tag: string, since?: number) {
  const params = new URLSearchParams({ tag });
  if (since) params.set("since", String(since));
  const res = await fetch(`${API_BASE}/integrations/mail/testmail?${params}`, {
    headers: await authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Testmail poll failed");
  return data as {
    ok: boolean;
    received?: boolean;
    count?: number;
    inbox?: string;
    email?: { from?: string; subject?: string; preview?: string };
  };
}

export async function markMailboxRead(id: string) {
  const res = await fetch(`${API_BASE}/mailbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ action: "mark-read", id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Update failed");
  return data;
}

export async function fetchApiActivity(
  page = 1,
  limit = 25,
  filters: { method?: string; status?: string; path?: string; email?: string; q?: string } = {}
) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.method) params.set("method", filters.method);
  if (filters.status) params.set("status", filters.status);
  if (filters.path) params.set("path", filters.path);
  if (filters.email) params.set("email", filters.email);
  if (filters.q) params.set("q", filters.q);
  const data = await apiGet<ApiActivityResponse>(`/activity?${params.toString()}`);
  return {
    ...data,
    entries: (data.items ?? data.entries ?? []).map((row) => ({
      ...row,
      timestamp: (row as ApiActivityEntry & { ts?: string }).ts ?? row.timestamp,
    })),
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
