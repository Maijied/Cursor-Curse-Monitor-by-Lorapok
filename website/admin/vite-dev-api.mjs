import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getMailTemplates } from "./functions/api/_shared/mail-templates.js";
import {
  GENERATED_DEV_NOTICE,
  buildBuiltinNotices,
  getHydratedBuiltinNotices,
  getNoticeTemplates,
} from "./functions/api/_shared/notice-catalog.js";
import {
  buildNoticeDraftFromChangelog,
  changelogNoticeId,
} from "./functions/api/_shared/changelog-notice.js";
import { readSubscribers, subscriberStats, upsertSubscriber } from "./functions/api/_shared/subscribers.js";
import { submitProductFeedback } from "./functions/api/_shared/feedback-submit.js";
import { broadcastToSubscribers } from "./functions/api/_shared/subscriber-broadcast.js";
import { enrichTags, filterPublishableTags } from "./functions/api/_shared/publishable-tags.js";
import { validateMarketplaceDeploy } from "./functions/api/_shared/marketplace-tag-policy.js";
import { liveTagFromSiteData } from "./functions/api/_shared/site-data.js";
import { buildBetaVersionPlan, buildVersionPlan } from "./functions/api/_shared/version-plan.js";
import { buildReadmeStatsFromSiteData, renderReadmeStatsSvg, renderShieldsBadge } from "./functions/api/_shared/readme-stats.js";
import { resolveBadgeKind } from "./functions/api/_shared/badge-endpoint.js";
import {
  DEFAULT_COMMUNITY_INVITE_URL,
  isValidDiscordInviteUrl,
  isValidDiscordWebhookUrl,
  sanitizeDiscordConfigForClient,
} from "./functions/api/_shared/discord-config.js";
import { notifyDiscordDeployment } from "./functions/api/_shared/discord-notify.js";
import { getMailTransportStatus } from "./functions/api/_shared/mail.js";
import {
  assignAdminRole,
  buildAdminAuthContext,
  buildRbacTeamSnapshot,
  readRbacMap,
  removeAdminRole,
  resolveAdminRole,
} from "./functions/api/_shared/rbac.js";
import {
  logAllowlistAdd,
  logAllowlistRemove,
  logRoleAssignment,
  logRoleClear,
} from "./functions/api/_shared/acl-audit.js";
import { sanitizeProfileForClient } from "./functions/api/_shared/user-profile.js";
import {
  DEFAULT_STATS_REFRESH_CONFIG,
  readStatsLiveCache,
  sanitizeStatsRefreshConfigForClient,
} from "./functions/api/_shared/stats-refresh-config.js";
import {
  DEFAULT_DISCORD_DIGEST_CONFIG,
  sanitizeDiscordDigestConfigForClient,
} from "./functions/api/_shared/discord-digest-config.js";
import {
  DEFAULT_SUBSCRIBE_CONFIG,
  buildPublicSiteConfig,
  sanitizeSubscribeConfigForClient,
} from "./functions/api/_shared/subscribe-config.js";
import {
  DEFAULT_MAIL_CONFIG,
  isValidSendingDomain,
  normalizeMailConfig,
  sanitizeMailConfigForClient,
} from "./functions/api/_shared/mail-config.js";
import { buildMailSetupInstructions } from "./functions/api/_shared/mail-setup-instructions.js";
import { buildMailSyncRecommendations } from "./functions/api/_shared/mail-sync.js";
import {
  DEFAULT_CURSOR_INDEX_CONFIG,
  normalizeCursorIndexConfig,
  sanitizeCursorIndexConfigForClient,
  validateCursorIndexPatch,
} from "./functions/api/_shared/cursor-index-config.js";
import {
  sanitizeReindexConfigForClient,
} from "./functions/api/_shared/reindex-config.js";
import {
  GITHUB_CRON_JOBS,
  MANAGED_CRON_JOBS,
} from "./functions/api/_shared/cron-jobs-registry.js";
import { runDiscordDigest } from "./functions/api/_shared/discord-digest.js";
import { mergeSiteDataWithLiveCache, runStatsRefresh } from "./functions/api/_shared/stats-refresh.js";
import {
  isCompleteFirebaseConfig,
  normalizeFirebaseConfig,
  readFirebaseConfig,
  sanitizeFirebaseConfigForClient,
  toPublicFirebaseClientConfig,
} from "./functions/api/_shared/firebase-config.js";
import {
  normalizeGithubIntegrationConfig,
  readGithubIntegrationConfig,
  sanitizeGithubIntegrationForClient,
} from "./functions/api/_shared/github-integration-config.js";
import {
  normalizeCloudflareIntegrationConfig,
  readCloudflareIntegrationConfig,
  sanitizeCloudflareIntegrationForClient,
} from "./functions/api/_shared/cloudflare-integration-config.js";
import {
  readResendIntegrationConfig,
  sanitizeResendIntegrationForClient,
  writeResendIntegrationMeta,
} from "./functions/api/_shared/resend-integration-config.js";
import {
  readEmailIdentitiesConfig,
  sanitizeEmailIdentitiesForClient,
  upsertIdentity,
  validateIdentityLocalPart,
  writeEmailIdentitiesConfig,
} from "./functions/api/_shared/email-identities-config.js";
import { provisionIdentityRouting } from "./functions/api/_shared/cloudflare-email-routing.js";
import { syncEmailIdentities } from "./functions/api/_shared/email-identities-sync.js";
import { isValidMailAddress } from "./functions/api/_shared/mail-config.js";
import { readSystemLogs } from "./functions/api/_shared/system-log.js";
import {
  normalizeTestmailIntegrationConfig,
  readTestmailIntegrationConfig,
  sanitizeTestmailIntegrationForClient,
  writeTestmailIntegrationConfig,
} from "./functions/api/_shared/testmail-integration-config.js";
import { envWithCursorCloudflareSecrets } from "./scripts/lib/cred-vault-sync.mjs";
import { getMasterEmail } from "./functions/api/_shared/admins.js";

const mergedDevSecrets = envWithCursorCloudflareSecrets(process.env);
for (const [key, value] of Object.entries(mergedDevSecrets)) {
  if (value != null && value !== "" && !process.env[key]) {
    process.env[key] = String(value);
  }
}

const rootDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(rootDir, "../..");
const visitorStatsPath = resolve(repoRoot, "website/visitor-stats.json");
const GITHUB_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";
const siteDataPath = resolve(repoRoot, "website/site-data.json");
const adminDataDir = resolve(rootDir, ".data");
const adminEmailsPath = resolve(adminDataDir, "admin-emails.json");

const devStore = {
  notice: { ...GENERATED_DEV_NOTICE },
  notices: buildBuiltinNotices(),
  subscribers: [],
  activity: [],
  mailbox: [],
  systemLogs: [],
  usageInstalls: new Map(),
  communityConfig: {
    featuredDiscussionUrls: [],
    defaultCategorySlug: "announcements",
    collaborateUrl: `https://github.com/${GITHUB_REPO}/discussions`,
    updatedAt: null,
    updatedBy: null,
  },
  discordConfig: {
    deploymentWebhookUrl: "",
    feedbackWebhookUrl: "",
    communityWebhookUrl: "",
    communityInviteUrl: DEFAULT_COMMUNITY_INVITE_URL,
    updatedAt: null,
    updatedBy: null,
  },
  mailConfig: { ...DEFAULT_MAIL_CONFIG, updatedAt: null, updatedBy: null },
  statsRefreshConfig: { ...DEFAULT_STATS_REFRESH_CONFIG },
  discordDigestConfig: { ...DEFAULT_DISCORD_DIGEST_CONFIG },
  subscribeConfig: { ...DEFAULT_SUBSCRIBE_CONFIG },
  cursorIndexConfig: { ...DEFAULT_CURSOR_INDEX_CONFIG },
  firebaseConfig: null,
  githubIntegration: normalizeGithubIntegrationConfig({}),
  cloudflareIntegration: normalizeCloudflareIntegrationConfig({}),
  userProfiles: {},
  statsLiveCache: null,
};

const devFunctionsEnv = () => ({
  ADMIN_KV: devKv,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  SITE_DATA_URL: process.env.SITE_DATA_URL ?? "https://cursor.lorapok.tech/site-data.json",
  ...(existsSync(siteDataPath) ? { SITE_DATA_FILE: siteDataPath } : {}),
  ANALYTICS_STATS_URL: process.env.ANALYTICS_STATS_URL,
  CRON_SECRET: process.env.CRON_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  TESTMAIL_API_KEY: process.env.TESTMAIL_API_KEY,
  TESTMAIL_NAMESPACE: process.env.TESTMAIL_NAMESPACE,
  VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MEASUREMENT_ID: process.env.VITE_FIREBASE_MEASUREMENT_ID,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  ADMIN_PUBLIC_URL: process.env.ADMIN_PUBLIC_URL,
  ADMIN_MASTER_EMAIL: process.env.ADMIN_MASTER_EMAIL ?? process.env.VITE_ADMIN_MASTER_EMAIL,
});

function resolveDevMasterEmail() {
  return getMasterEmail(devFunctionsEnv());
}

const devKvEntries = new Map();

const devKv = {
  get: async (key) => {
    if (devKvEntries.has(key)) return devKvEntries.get(key);
    if (key === "subscribers") {
      return JSON.stringify(devStore.subscribers);
    }
    if (key === "integrations:discord") {
      return JSON.stringify(devStore.discordConfig);
    }
    if (key === "integrations:mail") {
      return JSON.stringify(devStore.mailConfig);
    }
    if (key === "integrations:subscribe-prompt") {
      return JSON.stringify(devStore.subscribeConfig);
    }
    if (key === "integrations:cursor-index" || key === "integrations:reindex") {
      return JSON.stringify(devStore.cursorIndexConfig);
    }
    if (key === "integrations:stats-refresh") {
      return JSON.stringify(devStore.statsRefreshConfig);
    }
    if (key === "integrations:discord-digest") {
      return JSON.stringify(devStore.discordDigestConfig);
    }
    if (key === "integrations:firebase") {
      return devStore.firebaseConfig ? JSON.stringify(devStore.firebaseConfig) : null;
    }
    if (key === "integrations:github") {
      return JSON.stringify(devStore.githubIntegration);
    }
    if (key === "integrations:cloudflare") {
      return JSON.stringify(devStore.cloudflareIntegration);
    }
    if (key === "stats:live-cache") {
      return devStore.statsLiveCache ? JSON.stringify(devStore.statsLiveCache) : null;
    }
    return null;
  },
  put: async (key, value) => {
    devKvEntries.set(key, value);
    if (key === "subscribers") {
      devStore.subscribers = JSON.parse(value);
    }
    if (key === "integrations:discord") {
      devStore.discordConfig = JSON.parse(value);
    }
    if (key === "integrations:mail") {
      devStore.mailConfig = JSON.parse(value);
    }
    if (key === "integrations:subscribe-prompt") {
      devStore.subscribeConfig = JSON.parse(value);
    }
    if (key === "integrations:cursor-index" || key === "integrations:reindex") {
      devStore.cursorIndexConfig = JSON.parse(value);
    }
    if (key === "integrations:stats-refresh") {
      devStore.statsRefreshConfig = JSON.parse(value);
    }
    if (key === "integrations:discord-digest") {
      devStore.discordDigestConfig = JSON.parse(value);
    }
    if (key === "integrations:firebase") {
      devStore.firebaseConfig = JSON.parse(value);
    }
    if (key === "integrations:github") {
      devStore.githubIntegration = JSON.parse(value);
    }
    if (key === "integrations:cloudflare") {
      devStore.cloudflareIntegration = JSON.parse(value);
    }
    if (key === "stats:live-cache") {
      devStore.statsLiveCache = JSON.parse(value);
    }
  },
  list: async ({ prefix = "", limit = 1000, cursor } = {}) => {
    const keys = [...devKvEntries.keys()]
      .filter((name) => name.startsWith(prefix))
      .sort();
    const start = cursor ? Number(cursor) || 0 : 0;
    const slice = keys.slice(start, start + limit);
    return {
      keys: slice.map((name) => ({ name })),
      list_complete: start + limit >= keys.length,
      cursor: start + limit < keys.length ? String(start + limit) : undefined,
    };
  },
};

async function refreshDevBuiltinNotices() {
  devStore.notices = await getHydratedBuiltinNotices(devFunctionsEnv());
}

/**
 * Reset the development store to its default notice and Discord configuration.
 */
export async function resetDevStore() {
  devKvEntries.clear();
  devStore.notice = { ...GENERATED_DEV_NOTICE };
  devStore.subscribers = [];
  await refreshDevBuiltinNotices();
  devStore.discordConfig = {
    deploymentWebhookUrl: "",
    feedbackWebhookUrl: "",
    communityWebhookUrl: "",
    communityInviteUrl: DEFAULT_COMMUNITY_INVITE_URL,
    updatedAt: null,
    updatedBy: null,
  };
  devStore.mailConfig = { ...DEFAULT_MAIL_CONFIG, updatedAt: null, updatedBy: null };
  devStore.subscribeConfig = { ...DEFAULT_SUBSCRIBE_CONFIG };
  devStore.cursorIndexConfig = { ...DEFAULT_CURSOR_INDEX_CONFIG };
}

void refreshDevBuiltinNotices();

function logDevActivity(req, status, email = "dev@local") {
  const path = req.url?.split("?")[0] ?? "/";
  devStore.activity.unshift({
    ts: new Date().toISOString(),
    method: req.method ?? "GET",
    path,
    status,
    latencyMs: Math.floor(Math.random() * 120) + 20,
    email,
  });
  if (devStore.activity.length > 500) devStore.activity.length = 500;
}

function readDevAdminEmails() {
  try {
    if (!existsSync(adminEmailsPath)) return [];
    const parsed = JSON.parse(readFileSync(adminEmailsPath, "utf8"));
    return Array.isArray(parsed) ? parsed.map((e) => String(e).toLowerCase()) : [];
  } catch {
    return [];
  }
}

function writeDevAdminEmails(emails) {
  mkdirSync(adminDataDir, { recursive: true });
  const normalized = [...new Set(emails.map((e) => String(e).toLowerCase()).filter(Boolean))].sort();
  writeFileSync(adminEmailsPath, JSON.stringify(normalized, null, 2) + "\n");
  return normalized;
}

function mapPublishMarket(value) {
  const map = {
    both: "Both",
    "open-vsx-firefox": "Open VSX + Firefox AMO",
    "open-vsx-amo": "Open VSX + Firefox AMO",
    "open-vsx": "Open VSX",
    openvsx: "Open VSX",
    "vscode-marketplace": "VS Code Marketplace",
    vscode: "VS Code Marketplace",
    "firefox-amo": "Firefox AMO",
    "firefox": "Firefox AMO",
    Both: "Both",
    "Open VSX + Firefox AMO": "Open VSX + Firefox AMO",
    "Open VSX": "Open VSX",
    "VS Code Marketplace": "VS Code Marketplace",
    "Firefox AMO": "Firefox AMO",
  };
  return map[value] ?? null;
}

function mapReleaseChannel(value) {
  const map = {
    beta: "Beta (Pre-release)",
    production: "Production",
    "Beta (Pre-release)": "Beta (Pre-release)",
    Production: "Production",
  };
  return map[value] ?? null;
}

/**
 * Dispatches the CI/CD workflow with the specified inputs.
 * @param {Object} inputs - Workflow dispatch inputs, including marketplace and release channel values.
 * @param {string} successMessage - Message included in the successful result.
 * @returns {Object} The workflow dispatch result and submitted inputs.
 * @throws {Error} If required inputs are invalid, the GitHub token is unavailable, or the workflow request fails.
 */
async function dispatchCiCdWorkflow(inputs, successMessage) {
  const targetTag = inputs.target_tag;
  const publishMarket = inputs.publish_market;
  const releaseChannel = inputs.release_channel;
  if (inputs.action_type?.includes("publish-tag") || inputs.action_type?.includes("rollback")) {
    if (!targetTag) throw new Error("target_tag is required");
  }
  if (!publishMarket) throw new Error("Invalid publish_market");
  if (!releaseChannel) throw new Error("Invalid release_channel");
  if (inputs.action_type?.includes("publish-tag") || inputs.action_type?.includes("rollback")) {
    const policy = validateMarketplaceDeploy({
      targetTag,
      releaseChannel,
      publishMarket,
    });
    if (!policy.ok) throw new Error(policy.error);
  }

  const githubToken = loadGithubToken();
  if (!githubToken) throw new Error("GITHUB_TOKEN not configured in website/admin/.env");

  const githubRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/ci-cd.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "cursor-usage-monitor-dev",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs }),
    }
  );

  if (!githubRes.ok) {
    throw new Error(`Failed to trigger ci-cd.yml (${githubRes.status})`);
  }

  return {
    success: true,
    message: successMessage,
    workflow: "ci-cd.yml",
    ...inputs,
  };
}

async function triggerDeployment(body) {
  return dispatchCiCdWorkflow(
    {
      action_type: "publish-tag - Publish existing git tag to marketplaces",
      target_tag: body.target_tag ?? body.tag,
      publish_market: mapPublishMarket(body.publish_market ?? body.market),
      release_channel: mapReleaseChannel(body.release_channel ?? body.channel),
    },
    "Deployment triggered successfully"
  );
}

async function triggerRollback(body) {
  return dispatchCiCdWorkflow(
    {
      action_type: "rollback - Restore previous tag as a new version",
      target_tag: body.target_tag ?? body.tag,
      publish_market: mapPublishMarket(body.publish_market ?? body.market),
      release_channel: mapReleaseChannel(body.release_channel ?? body.channel),
    },
    "Rollback triggered"
  );
}

const VERSION_TYPE_INPUTS = {
  patch: "patch - Bug fix or Feature update (e.g. v0.7.1, v0.7.2)",
  minor: "minor - New Feature (e.g. v0.8.0)",
  major: "major - Production / Breaking (e.g. v1.0.0)",
  custom: "custom - Specify exact version below",
};

async function triggerInfraDeploy(body = {}) {
  const deployAdmin = body.deploy_admin !== false && body.deploy_admin !== "false";
  const deployWebsite = body.deploy_website !== false && body.deploy_website !== "false";
  return dispatchCiCdWorkflow(
    {
      action_type: "deploy-infra - Deploy Mission Control admin & marketing site",
      publish_market: "Both",
      release_channel: "Production",
      deploy_admin: deployAdmin ? "true" : "false",
      deploy_website: deployWebsite ? "true" : "false",
    },
    "Infra deploy triggered"
  );
}

async function triggerRelease(body) {
  const publishMarket = mapPublishMarket(body.publish_market ?? body.market);
  const releaseChannel = mapReleaseChannel(body.release_channel ?? body.channel);
  const bumpKey = String(body.version_type ?? body.bump_type ?? "patch");
  const versionTypeInput = VERSION_TYPE_INPUTS[bumpKey] ?? String(body.version_type ?? "");
  const customVersion = String(body.custom_version ?? "").trim();
  if (!publishMarket) throw new Error("Invalid publish_market");
  if (!releaseChannel) throw new Error("Invalid release_channel");
  if (!versionTypeInput) throw new Error("Invalid version_type");
  if (versionTypeInput.startsWith("custom") && !customVersion) {
    throw new Error("custom_version is required for custom releases");
  }

  const githubToken = loadGithubToken();
  if (!githubToken) throw new Error("GITHUB_TOKEN not configured in website/admin/.env");

  const githubRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/ci-cd.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "cursor-usage-monitor-dev",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          action_type: "full-release - Bump version, tag & update Mission Control",
          version_type: versionTypeInput,
          custom_version: customVersion,
          publish_market: publishMarket,
          release_channel: releaseChannel,
          deploy_admin: body.deploy_admin === false || body.deploy_admin === "false" ? "false" : "true",
          deploy_website: body.deploy_website === false || body.deploy_website === "false" ? "false" : "true",
        },
      }),
    }
  );

  if (!githubRes.ok) {
    throw new Error(`Failed to trigger ci-cd.yml (${githubRes.status})`);
  }

  return {
    success: true,
    message: "Release workflow triggered successfully",
    workflow: "ci-cd.yml",
    version_type: bumpKey,
    custom_version: customVersion,
    publish_market: publishMarket,
    release_channel: releaseChannel,
  };
}

function loadGithubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const envPath = resolve(rootDir, ".env");
  if (!existsSync(envPath)) return null;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^GITHUB_TOKEN=(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function githubHeaders() {
  const token = loadGithubToken();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "cursor-usage-monitor-dev",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function readCachedTags() {
  try {
    const data = JSON.parse(readFileSync(siteDataPath, "utf8"));
    if (Array.isArray(data.github?.tags) && data.github.tags.length > 0) {
      return data.github.tags;
    }
    if (data.github?.releaseTag) return [data.github.releaseTag];
    if (data.packageVersion) return [`v${String(data.packageVersion).replace(/^v/, "")}`];
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Reads the live release tag from local site data.
 * @return {string|null} The live release tag, or `null` if the site data cannot be read or parsed.
 */
function readLiveTag() {
  try {
    const data = JSON.parse(readFileSync(siteDataPath, "utf8"));
    return liveTagFromSiteData(data);
  } catch {
    return null;
  }
}

/**
 * Fetches publishable GitHub tags and falls back to cached site data when the API is unavailable.
 * @returns {{tags: Array, source: string, warning?: string}} Enriched publishable tags with their data source and an optional fallback warning.
 * @throws {Error} If GitHub returns an error and no cached tags are available.
 */
async function fetchGitHubTags() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=100`, {
    headers: githubHeaders(),
  });
  const liveTag = readLiveTag();
  if (res.ok) {
    const data = await res.json();
    const raw = Array.isArray(data) ? data.map((t) => t.name).filter(Boolean) : [];
    return { ...enrichTags(filterPublishableTags(raw), liveTag), source: "github" };
  }
  const cached = readCachedTags();
  if (cached.length > 0) {
    const msg = res.status === 403
      ? "GitHub API rate limit — using cached tags from site-data.json. Add GITHUB_TOKEN to website/admin/.env"
      : `GitHub tags ${res.status} — using cached tags from site-data.json`;
    return { ...enrichTags(filterPublishableTags(cached), liveTag), source: "cache", warning: msg };
  }
  if (res.status === 403) {
    throw new Error("GitHub API rate limit exceeded. Add GITHUB_TOKEN to website/admin/.env and restart npm run dev.");
  }
  throw new Error(`GitHub tags ${res.status}`);
}

const DEFAULT_STATS = {
  websiteVisits: 0,
  packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, npm: 0, openvsxDuplicate: 0 },
  totalEngagement: 0,
  updatedAt: null,
};

const ALLOWED_CLICK_CHANNELS = new Set([
  "ovsx",
  "vscode",
  "github",
  "vsix",
  "npm",
  "openvsxDuplicate",
]);

function readStats() {
  if (!existsSync(visitorStatsPath)) return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  try {
    return JSON.parse(readFileSync(visitorStatsPath, "utf8"));
  } catch {
    return { ...DEFAULT_STATS, packageClicks: { ...DEFAULT_STATS.packageClicks } };
  }
}

function writeStats(stats) {
  writeFileSync(visitorStatsPath, JSON.stringify(stats, null, 2) + "\n");
}

function incrementStats(channel) {
  const stats = readStats();
  if (!stats.packageClicks) stats.packageClicks = { ...DEFAULT_STATS.packageClicks };

  if (channel === "website") {
    stats.websiteVisits = (stats.websiteVisits ?? 0) + 1;
  } else if (ALLOWED_CLICK_CHANNELS.has(channel)) {
    stats.packageClicks[channel] = (stats.packageClicks[channel] ?? 0) + 1;
  } else {
    return stats;
  }

  stats.totalEngagement =
    (stats.websiteVisits ?? 0) +
    Object.values(stats.packageClicks).reduce((s, n) => s + (n ?? 0), 0);
  stats.updatedAt = new Date().toISOString();
  writeStats(stats);
  return stats;
}

async function fetchDiscussions() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/discussions?per_page=10`, {
    headers: githubHeaders(),
  });
  const enabled = res.ok;
  let discussions = [];
  if (enabled) {
    const data = await res.json();
    discussions = Array.isArray(data)
      ? data.map((d) => ({
          title: d.title,
          url: d.html_url,
          category: d.category?.name ?? "General",
          createdAt: d.created_at,
          comments: d.comments ?? 0,
        }))
      : [];
  }

  const issuesRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/issues?state=all&per_page=20&sort=updated`,
    { headers: githubHeaders() }
  );
  const topics = [];
  if (issuesRes.ok) {
    const issues = await issuesRes.json();
    const map = new Map();
    for (const issue of issues) {
      if (issue.pull_request) continue;
      const labels = (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);
      const topic = labels[0] ?? "General";
      if (!map.has(topic)) map.set(topic, { topic, count: 0, items: [] });
      const entry = map.get(topic);
      entry.count += 1;
      if (entry.items.length < 5) {
        entry.items.push({ title: issue.title, url: issue.html_url, state: issue.state });
      }
    }
    topics.push(...map.values());
  }

  return {
    enabled,
    discussions,
    topics,
    settingsUrl: `https://github.com/${GITHUB_REPO}/settings#features`,
    manageCategoriesUrl: `https://github.com/${GITHUB_REPO}/discussions/categories`,
    discussionsUrl: `https://github.com/${GITHUB_REPO}/discussions`,
    repoIssuesUrl: `https://github.com/${GITHUB_REPO}/issues`,
    categories: [
      { id: "dev-announce", name: "Announcements", slug: "announcements", emoji: "", description: "", isAnswerable: false, format: "announcement" },
      { id: "dev-general", name: "General", slug: "general", emoji: "", description: "", isAnswerable: false, format: "discussion" },
      { id: "dev-qa", name: "Q&A", slug: "q-a", emoji: "", description: "", isAnswerable: true, format: "qa" },
    ],
    repositoryId: "dev-repo",
    capabilities: {
      canCreatePosts: Boolean(loadGithubToken()),
      canManageCategories: false,
      canCreatePolls: false,
      tokenConfigured: Boolean(loadGithubToken()),
    },
  };
}

async function fetchGitHubReleases() {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`, {
    headers: githubHeaders(),
  });
  if (!res.ok) throw new Error(`GitHub releases ${res.status}`);
  const data = await res.json();
  return Array.isArray(data)
    ? data.map((r) => ({
        tag: r.tag_name,
        name: r.name,
        url: r.html_url,
        publishedAt: r.published_at,
        prerelease: r.prerelease,
        draft: r.draft,
        vsix: (r.assets ?? []).find((a) => a.name?.endsWith(".vsix")) ?? null,
      }))
    : [];
}

async function fetchWorkflowRuns() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=20&exclude_pull_requests=true`,
    { headers: githubHeaders() }
  );
  if (!res.ok) throw new Error(`GitHub runs ${res.status}`);
  const data = await res.json();
  return {
    runs: (data.workflow_runs ?? []).map((run) => ({
      id: run.id,
      name: run.name,
      workflow: run.path?.replace(/^\.github\/workflows\//, "") ?? run.name,
      status: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      branch: run.head_branch,
      event: run.event,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    })),
    total: data.total_count ?? 0,
  };
}

async function fetchMarketplaceSync() {
  const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
  const name = siteData.extensionName ?? "cursor-curse-monitor-by-lorapok";
  const target = String(siteData.packageVersion ?? siteData.version ?? "").replace(/^v/, "");
  const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    return res.ok ? res.json() : null;
  };
  const [ovsxCanonical, ovsxDuplicate, githubRelease] = await Promise.all([
    fetchJson(`https://open-vsx.org/api/lorapok-labs/${name}`),
    fetchJson(`https://open-vsx.org/api/LorapokLabs/${name}`),
    fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`),
  ]);
  const vscodeVersion = siteData.vscode?.version ?? null;
  const channels = [
    { id: "github", label: "GitHub Release", version: githubRelease?.tag_name?.replace(/^v/, "") ?? null, synced: githubRelease?.tag_name?.replace(/^v/, "") === target },
    { id: "ovsx-canonical", label: "Open VSX (lorapok-labs)", version: ovsxCanonical?.version ?? siteData.openVsx?.version ?? null, downloadCount: ovsxCanonical?.downloadCount ?? 0, synced: (ovsxCanonical?.version ?? siteData.openVsx?.version) === target },
    { id: "ovsx-duplicate", label: "Open VSX (LorapokLabs)", version: ovsxDuplicate?.version ?? null, downloadCount: ovsxDuplicate?.downloadCount ?? 0, synced: false, warn: true },
    { id: "vscode", label: "VS Code Marketplace", version: vscodeVersion, downloadCount: siteData.vscode?.downloadCount ?? 0, synced: vscodeVersion === target },
    { id: "package", label: "package.json", version: target, synced: true },
  ];
  return {
    packageVersion: target,
    syncStatus: channels.filter((c) => !c.warn).every((c) => c.synced) ? "synced" : "drift",
    channels,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Create development-mode HTTP middleware for API routes, analytics, usage tracking, integrations, administration, deployments, notifications, and release data.
 * @return {Function} Middleware that handles recognized API requests and delegates unrecognized requests to the next handler.
 */
export function createDevApiMiddleware() {
  return (req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";

    if (url === "/api/analytics/stats" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(readStats()));
      return;
    }

    if (url === "/api/analytics/visit" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const stats = incrementStats(parsed.channel || "website");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, stats }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid payload" }));
        }
      });
      return;
    }

    if (url === "/api/usage/ping" && req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (url === "/api/usage/ping" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        try {
          const parsed = JSON.parse(body || "{}");
          const installId = String(parsed.installId ?? "").trim().toLowerCase();
          if (!/^[0-9a-f-]{36}$/i.test(installId)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "installId must be a UUID" }));
            return;
          }
          const now = new Date().toISOString();
          const prev = devStore.usageInstalls.get(installId);
          devStore.usageInstalls.set(installId, {
            installId,
            os: String(parsed.os ?? "unknown").slice(0, 32),
            host: ["cursor", "vscode", "browser"].includes(String(parsed.host)) ? parsed.host : "unknown",
            version: String(parsed.version ?? "unknown").slice(0, 32),
            lastSeenAt: now,
            firstSeenAt: prev?.firstSeenAt ?? now,
          });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/stats/readme.svg" && req.method === "GET") {
      try {
        const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
        const stats = buildReadmeStatsFromSiteData(siteData);
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(renderReadmeStatsSvg(stats));
      } catch {
        res.statusCode = 503;
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="80"><text x="12" y="40" fill="#fff">stats unavailable</text></svg>`);
      }
      return;
    }

    if (url.startsWith("/api/stats/badge.json") && req.method === "GET") {
      const kind = resolveBadgeKind(new URL(req.url ?? "", "http://localhost").searchParams.get("kind"));
      try {
        const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
        const stats = buildReadmeStatsFromSiteData(siteData);
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(JSON.stringify(renderShieldsBadge(stats, kind)));
      } catch {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ schemaVersion: 1, label: "downloads", message: "unavailable", color: "lightgrey" }));
      }
      return;
    }

    const shieldsBadgeMatch = url.match(/^\/api\/stats\/shields\/([^/?]+)\.svg$/);
    if (shieldsBadgeMatch && req.method === "GET") {
      const kind = resolveBadgeKind(shieldsBadgeMatch[1]);
      try {
        const siteData = JSON.parse(readFileSync(siteDataPath, "utf8"));
        const stats = buildReadmeStatsFromSiteData(siteData);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        res.end(JSON.stringify(renderShieldsBadge(stats, kind)));
      } catch {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ schemaVersion: 1, label: "downloads", message: "unavailable", color: "lightgrey" }));
      }
      return;
    }

    if (url === "/api/usage/stats" && req.method === "GET") {
      const records = [...devStore.usageInstalls.values()];
      const now = Date.now();
      const cut5m = now - 5 * 60 * 1000;
      const cut1h = now - 60 * 60 * 1000;
      const cut24h = now - 24 * 60 * 60 * 1000;
      const cut7 = now - 7 * 86400000;
      const cut30 = now - 30 * 86400000;
      const byOs = {};
      const byHost = {};
      let activeNow = 0;
      let unique1h = 0;
      let unique24h = 0;
      let unique7d = 0;
      let unique30d = 0;
      for (const r of records) {
        const seen = Date.parse(r.lastSeenAt || "") || 0;
        if (seen >= cut5m) activeNow += 1;
        if (seen >= cut1h) unique1h += 1;
        if (seen >= cut24h) unique24h += 1;
        if (seen >= cut7) unique7d += 1;
        if (seen >= cut30) unique30d += 1;
        byOs[r.os] = (byOs[r.os] ?? 0) + 1;
        byHost[r.host] = (byHost[r.host] ?? 0) + 1;
      }
      let visitors = null;
      let marketplace = null;
      try {
        const site = JSON.parse(readFileSync(siteDataPath, "utf8"));
        visitors = site.visitors ?? null;
        marketplace = site.downloads ?? site.marketplace ?? null;
      } catch { /* ignore */ }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        optInUniques: { activeNow, unique1h, unique24h, unique7d, unique30d, uniqueAll: records.length, byOs, byHost },
        marketplace,
        visitors,
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (url === "/api/community/config" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify(devStore.communityConfig));
      return;
    }

    if (url === "/api/site-config" && req.method === "GET") {
      buildPublicSiteConfig(devFunctionsEnv())
        .then((config) => {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cache-Control", "public, max-age=60");
          res.end(JSON.stringify({ ok: true, ...config, checkedAt: new Date().toISOString() }));
        })
        .catch((err) => {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "site-config unavailable" }));
        });
      return;
    }

    if (url === "/api/site-config" && req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (url === "/api/site-data" && req.method === "GET") {
      readStatsLiveCache(devFunctionsEnv())
        .then((cache) => {
          const base = JSON.parse(readFileSync(siteDataPath, "utf8"));
          const site = mergeSiteDataWithLiveCache(base, cache);
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "public, max-age=60");
          res.end(JSON.stringify(site));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "site-data unavailable" }));
        });
      return;
    }

    if (url === "/api/integrations/discord/config" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, config: sanitizeDiscordConfigForClient(devStore.discordConfig) }));
      return;
    }

    if (url === "/api/integrations/discord/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const current = devStore.discordConfig;
          let deploymentWebhookUrl = current.deploymentWebhookUrl ?? current.webhookUrl ?? "";
          let feedbackWebhookUrl = current.feedbackWebhookUrl ?? "";
          let communityWebhookUrl = current.communityWebhookUrl ?? "";
          let communityInviteUrl = current.communityInviteUrl ?? DEFAULT_COMMUNITY_INVITE_URL;

          if (parsed.deploymentWebhookUrl !== undefined || parsed.webhookUrl !== undefined) {
            deploymentWebhookUrl = String(parsed.deploymentWebhookUrl ?? parsed.webhookUrl ?? "").trim();
            if (!isValidDiscordWebhookUrl(deploymentWebhookUrl)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid deployment Discord webhook URL" }));
              return;
            }
          }
          if (parsed.feedbackWebhookUrl !== undefined) {
            feedbackWebhookUrl = String(parsed.feedbackWebhookUrl ?? "").trim();
            if (feedbackWebhookUrl && !isValidDiscordWebhookUrl(feedbackWebhookUrl)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid feedback Discord webhook URL" }));
              return;
            }
          }
          if (parsed.communityWebhookUrl !== undefined) {
            communityWebhookUrl = String(parsed.communityWebhookUrl ?? "").trim();
            if (communityWebhookUrl && !isValidDiscordWebhookUrl(communityWebhookUrl)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid community Discord webhook URL" }));
              return;
            }
          }

          if (parsed.communityInviteUrl !== undefined) {
            communityInviteUrl = String(parsed.communityInviteUrl ?? "").trim();
            if (!communityInviteUrl) {
              communityInviteUrl = DEFAULT_COMMUNITY_INVITE_URL;
            } else if (!isValidDiscordInviteUrl(communityInviteUrl)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid community Discord invite URL" }));
              return;
            }
          }

          devStore.discordConfig = {
            deploymentWebhookUrl,
            feedbackWebhookUrl,
            communityWebhookUrl,
            communityInviteUrl,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, config: sanitizeDiscordConfigForClient(devStore.discordConfig) }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/firebase-config" && req.method === "GET") {
      readFirebaseConfig(devFunctionsEnv())
        .then((config) => {
          const client = toPublicFirebaseClientConfig(config);
          res.setHeader("Content-Type", "application/json");
          if (!client) {
            res.statusCode = 503;
            res.end(JSON.stringify({ ok: false, error: "Firebase is not configured" }));
            return;
          }
          res.end(JSON.stringify({ ok: true, config: client }));
        })
        .catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/integrations/firebase/config" && req.method === "GET") {
      readFirebaseConfig(devFunctionsEnv())
        .then((config) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, config: sanitizeFirebaseConfigForClient(config) }));
        })
        .catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/integrations/firebase/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const current = (await readFirebaseConfig(devFunctionsEnv())) ?? normalizeFirebaseConfig({});
          const next = normalizeFirebaseConfig({
            ...current,
            apiKey: parsed.apiKey !== undefined ? String(parsed.apiKey ?? "").trim() : current.apiKey,
            authDomain: parsed.authDomain !== undefined ? String(parsed.authDomain ?? "").trim() : current.authDomain,
            projectId: parsed.projectId !== undefined ? String(parsed.projectId ?? "").trim() : current.projectId,
            storageBucket:
              parsed.storageBucket !== undefined ? String(parsed.storageBucket ?? "").trim() : current.storageBucket,
            messagingSenderId:
              parsed.messagingSenderId !== undefined
                ? String(parsed.messagingSenderId ?? "").trim()
                : current.messagingSenderId,
            appId: parsed.appId !== undefined ? String(parsed.appId ?? "").trim() : current.appId,
            measurementId:
              parsed.measurementId !== undefined ? String(parsed.measurementId ?? "").trim() : current.measurementId,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
            githubSecretsSyncedAt: new Date().toISOString(),
          });
          if (!isCompleteFirebaseConfig(next)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Incomplete Firebase config" }));
            return;
          }
          devStore.firebaseConfig = next;
          await devKv.put("integrations:firebase", JSON.stringify(next));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, config: sanitizeFirebaseConfigForClient(next) }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/github/config" && req.method === "GET") {
      readGithubIntegrationConfig(devFunctionsEnv())
        .then((config) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeGithubIntegrationForClient(config, devFunctionsEnv(), []),
            })
          );
        })
        .catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/integrations/github/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const current = await readGithubIntegrationConfig(devFunctionsEnv());
          const next = normalizeGithubIntegrationConfig({
            repository: parsed.repository !== undefined ? String(parsed.repository ?? "").trim() : current.repository,
            secretsEnvironment:
              parsed.secretsEnvironment !== undefined
                ? String(parsed.secretsEnvironment ?? "").trim()
                : current.secretsEnvironment,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
            githubSecretsSyncedAt: current.githubSecretsSyncedAt,
          });
          devStore.githubIntegration = next;
          await devKv.put("integrations:github", JSON.stringify(next));
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeGithubIntegrationForClient(next, devFunctionsEnv(), []),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/cloudflare/config" && req.method === "GET") {
      readCloudflareIntegrationConfig(devFunctionsEnv())
        .then((config) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeCloudflareIntegrationForClient(config, devFunctionsEnv(), []),
            })
          );
        })
        .catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/integrations/cloudflare/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const current = await readCloudflareIntegrationConfig(devFunctionsEnv());
          const next = normalizeCloudflareIntegrationConfig({
            ...current,
            accountId: parsed.accountId !== undefined ? String(parsed.accountId ?? "").trim() : current.accountId,
            pagesProjectName:
              parsed.pagesProjectName !== undefined
                ? String(parsed.pagesProjectName ?? "").trim()
                : current.pagesProjectName,
            adminPublicUrl:
              parsed.adminPublicUrl !== undefined ? String(parsed.adminPublicUrl ?? "").trim() : current.adminPublicUrl,
            siteDataUrl: parsed.siteDataUrl !== undefined ? String(parsed.siteDataUrl ?? "").trim() : current.siteDataUrl,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
            githubSecretsSyncedAt: new Date().toISOString(),
          });
          devStore.cloudflareIntegration = next;
          await devKv.put("integrations:cloudflare", JSON.stringify(next));
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeCloudflareIntegrationForClient(next, devFunctionsEnv(), []),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/resend/config" && req.method === "GET") {
      readResendIntegrationConfig(devFunctionsEnv())
        .then((config) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeResendIntegrationForClient(config, devFunctionsEnv(), []),
            })
          );
        })
        .catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/integrations/resend/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const current = await readResendIntegrationConfig(devFunctionsEnv());
          const patch = { updatedBy: "dev@local" };
          if (parsed.sendingDomain !== undefined) {
            const domain = String(parsed.sendingDomain ?? "").trim().toLowerCase();
            if (!isValidSendingDomain(domain)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid sending domain" }));
              return;
            }
            patch.sendingDomain = domain;
          }
          if (parsed.resendFromOverride !== undefined) {
            patch.resendFromOverride = String(parsed.resendFromOverride ?? "").trim();
          }
          if (parsed.resendDomainVerified !== undefined) {
            patch.resendDomainVerified = parsed.resendDomainVerified === true;
          }
          if (parsed.resendFirstExternal !== undefined) {
            patch.resendFirstExternal = parsed.resendFirstExternal !== false;
          }
          if (parsed.workersFreeMode !== undefined) {
            patch.workersFreeMode = parsed.workersFreeMode !== false;
          }
          if (parsed.resendApiKey !== undefined && String(parsed.resendApiKey ?? "").trim()) {
            process.env.RESEND_API_KEY = String(parsed.resendApiKey).trim();
          }
          if (parsed.resendFrom !== undefined && String(parsed.resendFrom ?? "").trim()) {
            process.env.RESEND_FROM = String(parsed.resendFrom).trim();
          }
          const next = {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
            githubSecretsSyncedAt: new Date().toISOString(),
          };
          devStore.mailConfig = normalizeMailConfig({
            ...devStore.mailConfig,
            sendingDomain: next.sendingDomain,
            resendFromOverride: next.resendFromOverride,
            resendDomainVerified: next.resendDomainVerified,
            resendFirstExternal: next.resendFirstExternal,
            workersFreeMode: next.workersFreeMode,
            updatedAt: next.updatedAt,
            updatedBy: next.updatedBy,
          });
          await devKv.put("integrations:mail", JSON.stringify(devStore.mailConfig));
          await writeResendIntegrationMeta(devFunctionsEnv(), next);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeResendIntegrationForClient(next, devFunctionsEnv(), []),
              githubSecretsSyncedAt: next.githubSecretsSyncedAt,
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/email-identities/config" && req.method === "GET") {
      readEmailIdentitiesConfig(devFunctionsEnv())
        .then((config) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, config: sanitizeEmailIdentitiesForClient(config) }));
        })
        .catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/integrations/email-identities/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const current = await readEmailIdentitiesConfig(devFunctionsEnv());
          let next = { ...current };
          if (parsed.opsForwardTo !== undefined) {
            const forwardTo = String(parsed.opsForwardTo ?? "").trim().toLowerCase();
            if (!isValidMailAddress(forwardTo)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid ops forward address" }));
              return;
            }
            next.opsForwardTo = forwardTo;
          }
          next.updatedAt = new Date().toISOString();
          next.updatedBy = "dev@local";
          await writeEmailIdentitiesConfig(devFunctionsEnv(), next);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, config: sanitizeEmailIdentitiesForClient(next) }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/email-identities/provision" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const localCheck = validateIdentityLocalPart(parsed?.localPart);
          if (!localCheck.ok) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: localCheck.error }));
            return;
          }
          const config = await readEmailIdentitiesConfig(devFunctionsEnv());
          const forwardTo = String(parsed?.forwardTo ?? config.opsForwardTo).trim().toLowerCase();
          if (!isValidMailAddress(forwardTo)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Valid forwardTo email is required" }));
            return;
          }
          const localPart = localCheck.value;
          const address = `${localPart}@${config.domain}`;
          const provision =
            parsed?.dryRun === true
              ? {
                  simulated: true,
                  routingStatus: "pending",
                  cloudflareRuleId: null,
                  message: "Dry run — no Cloudflare API call",
                }
              : await provisionIdentityRouting(devFunctionsEnv(), {
                  address,
                  forwardTo,
                  ruleName: localPart.replace(/\./g, "-"),
                });
          let next = upsertIdentity(config, localPart, {
            displayName: String(parsed?.displayName ?? localPart).trim().slice(0, 80) || localPart,
            category: String(parsed?.category ?? "custom").toLowerCase(),
            forwardTo,
            enabled: true,
            routingStatus: provision.routingStatus,
            cloudflareRuleId: provision.cloudflareRuleId,
            provisionedAt: new Date().toISOString(),
          });
          next = { ...next, updatedAt: new Date().toISOString(), updatedBy: "dev@local" };
          await writeEmailIdentitiesConfig(devFunctionsEnv(), next);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              provision,
              identity: sanitizeEmailIdentitiesForClient(next).identities.find((i) => i.localPart === localPart),
              config: sanitizeEmailIdentitiesForClient(next),
            })
          );
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Provision failed" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/email-identities/sync" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = await syncEmailIdentities(devFunctionsEnv(), {
            dryRun: parsed?.dryRun === true,
            enableRouting: parsed?.enableRouting !== false,
            ensureDestination: parsed?.ensureDestination !== false,
            updatedBy: "dev@local",
          });
          res.statusCode = result.ok ? 200 : 207;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Sync failed" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/testmail/config" && req.method === "GET") {
      readTestmailIntegrationConfig(devFunctionsEnv())
        .then((config) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeTestmailIntegrationForClient(config, devFunctionsEnv(), []),
            })
          );
        })
        .catch((err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/integrations/testmail/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const current = await readTestmailIntegrationConfig(devFunctionsEnv());
          const next = normalizeTestmailIntegrationConfig({
            ...current,
            namespace: parsed.namespace !== undefined ? String(parsed.namespace ?? "").trim() : current.namespace,
            probeEnabled: parsed.probeEnabled !== undefined ? parsed.probeEnabled !== false : current.probeEnabled,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
            githubSecretsSyncedAt: new Date().toISOString(),
          });
          if (parsed.testmailApiKey !== undefined && String(parsed.testmailApiKey ?? "").trim()) {
            process.env.TESTMAIL_API_KEY = String(parsed.testmailApiKey).trim();
          }
          if (next.namespace) {
            process.env.TESTMAIL_NAMESPACE = next.namespace;
          }
          await writeTestmailIntegrationConfig(devFunctionsEnv(), next);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeTestmailIntegrationForClient(next, devFunctionsEnv(), []),
              githubSecretsSyncedAt: next.githubSecretsSyncedAt,
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/mail/config" && req.method === "GET") {
      const transport = getMailTransportStatus(devFunctionsEnv());
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          config: sanitizeMailConfigForClient(
            devStore.mailConfig,
            transport,
            devFunctionsEnv()
          ),
          setupInstructions: buildMailSetupInstructions(devStore.mailConfig, transport),
        })
      );
      return;
    }

    if (url === "/api/integrations/mail/status" && req.method === "GET") {
      const transport = getMailTransportStatus(devFunctionsEnv());
      const sanitized = sanitizeMailConfigForClient(
        devStore.mailConfig,
        transport,
        devFunctionsEnv()
      );
      const subscribeConfig = devStore.subscribeConfig ?? DEFAULT_SUBSCRIBE_CONFIG;
      const mailConfigured = transport.configured;
      const subscribeAvailable =
        subscribeConfig.subscribeModalEnabled &&
        (!subscribeConfig.requireMailForSubscribe || mailConfigured);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          checkedAt: new Date().toISOString(),
          transport: {
            configured: transport.configured,
            transport: transport.transport ?? "none",
            relayBound: transport.relayBound ?? false,
            restConfigured: transport.restConfigured ?? false,
            resendConfigured: transport.resendConfigured ?? false,
            hint: transport.hint,
          },
          identities: {
            productEmail: sanitized.productEmail,
            supportEmail: sanitized.supportEmail,
            opsBccEmail: sanitized.opsBccEmail,
            productFromName: sanitized.productFromName,
            supportFromName: sanitized.supportFromName,
            resendFirstExternal: sanitized.resendFirstExternal,
            workersFreeMode: sanitized.workersFreeMode,
            sendingDomain: sanitized.sendingDomain,
            resendFromOverride: sanitized.resendFromOverride,
            resendDomainVerified: sanitized.resendDomainVerified,
            resendFromEnvConfigured: sanitized.resendFromEnvConfigured,
            testmailConfigured: sanitized.testmailConfigured,
            updatedAt: sanitized.updatedAt,
            updatedBy: sanitized.updatedBy,
          },
          setupInstructions: buildMailSetupInstructions(devStore.mailConfig, transport),
          recommendations: buildMailSyncRecommendations(transport, devStore.mailConfig),
          mailConfigured,
          subscribeAvailable,
          subscribeModalEnabled: subscribeConfig.subscribeModalEnabled,
          requireMailForSubscribe: subscribeConfig.requireMailForSubscribe,
        })
      );
      return;
    }

    if (url === "/api/integrations/mail/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Request body must be a JSON object" }));
            return;
          }
          if (
            parsed.resendFirstExternal !== undefined &&
            typeof parsed.resendFirstExternal !== "boolean"
          ) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "resendFirstExternal must be a boolean" }));
            return;
          }
          if (parsed.workersFreeMode !== undefined && typeof parsed.workersFreeMode !== "boolean") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "workersFreeMode must be a boolean" }));
            return;
          }
          if (parsed.sendingDomain !== undefined && !isValidSendingDomain(parsed.sendingDomain)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid sending domain" }));
            return;
          }
          if (
            parsed.resendDomainVerified !== undefined &&
            typeof parsed.resendDomainVerified !== "boolean"
          ) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "resendDomainVerified must be a boolean" }));
            return;
          }
          devStore.mailConfig = normalizeMailConfig({
            ...devStore.mailConfig,
            ...parsed,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
          });
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeMailConfigForClient(
                devStore.mailConfig,
                getMailTransportStatus(devFunctionsEnv()),
                devFunctionsEnv()
              ),
              setupInstructions: buildMailSetupInstructions(
                devStore.mailConfig,
                getMailTransportStatus(devFunctionsEnv())
              ),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/discord/feedback" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        let parsed;
        try {
          parsed = JSON.parse(body || "{}");
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }
        try {
          const { notifyDiscordFeedback } = await import("./functions/api/_shared/discord-feedback-notify.js");
          const result = await notifyDiscordFeedback({ ADMIN_KV: devKv }, {
            summary: parsed.summary,
            triggeredBy: "dev@local",
          });
          res.setHeader("Content-Type", "application/json");
          if (!result.ok && !result.skipped) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: result.error || "Discord feedback notification failed" }));
            return;
          }
          res.end(JSON.stringify({ ok: true, skipped: result.skipped ?? false }));
        } catch {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Discord feedback notification failed" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/discord/community" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        let parsed;
        try {
          parsed = JSON.parse(body || "{}");
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid JSON" }));
            return;
          }
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }
        try {
          const { notifyDiscordCommunity } = await import("./functions/api/_shared/discord-community-notify.js");
          const result = await notifyDiscordCommunity({ ADMIN_KV: devKv }, {
            summary: parsed.summary,
            triggeredBy: "dev@local",
          });
          res.setHeader("Content-Type", "application/json");
          if (!result.ok && !result.skipped) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: result.error || "Discord community notification failed" }));
            return;
          }
          res.end(JSON.stringify({ ok: true, skipped: result.skipped ?? false }));
        } catch {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Discord community notification failed" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/discord/deployment" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          notifyDiscordDeployment({ ADMIN_KV: devKv }, {
            phase: "completed",
            actionType: parsed.actionType ?? "deployment",
            tag: parsed.tag,
            channel: parsed.channel,
            market: parsed.market,
            conclusion: parsed.conclusion ?? "success",
            runUrl: parsed.runUrl,
            triggeredBy: parsed.triggeredBy ?? "dev@local",
            jobs: parsed.jobs ?? [],
          })
            .then((result) => {
              res.setHeader("Content-Type", "application/json");
              if (!result.ok && !result.skipped) {
                res.statusCode = 502;
                res.end(JSON.stringify({ error: result.error || "Discord notification failed" }));
                return;
              }
              res.end(JSON.stringify({
                ok: result.ok,
                skipped: result.skipped ?? false,
                reason: result.reason,
              }));
            })
            .catch((err) => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message || "Discord notification failed" }));
            });
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/subscribe/config" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          config: sanitizeSubscribeConfigForClient(devStore.subscribeConfig),
        })
      );
      return;
    }

    if (url === "/api/integrations/subscribe/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          if (
            parsed.subscribeFallbackDiscordUrl !== undefined &&
            parsed.subscribeFallbackDiscordUrl !== null &&
            parsed.subscribeFallbackDiscordUrl !== "" &&
            !isValidDiscordInviteUrl(String(parsed.subscribeFallbackDiscordUrl))
          ) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid Discord invite URL" }));
            return;
          }
          devStore.subscribeConfig = {
            ...devStore.subscribeConfig,
            subscribeModalEnabled:
              typeof parsed.subscribeModalEnabled === "boolean"
                ? parsed.subscribeModalEnabled
                : devStore.subscribeConfig.subscribeModalEnabled,
            requireMailForSubscribe:
              typeof parsed.requireMailForSubscribe === "boolean"
                ? parsed.requireMailForSubscribe
                : devStore.subscribeConfig.requireMailForSubscribe,
            subscribeFallbackDiscordUrl:
              parsed.subscribeFallbackDiscordUrl !== undefined
                ? String(parsed.subscribeFallbackDiscordUrl ?? "").trim()
                : devStore.subscribeConfig.subscribeFallbackDiscordUrl,
            subscribeFallbackMode:
              parsed.subscribeFallbackMode === "discord" || parsed.subscribeFallbackMode === "hidden"
                ? parsed.subscribeFallbackMode
                : devStore.subscribeConfig.subscribeFallbackMode,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
          };
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeSubscribeConfigForClient(devStore.subscribeConfig),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/cursor-index/config" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          config: sanitizeCursorIndexConfigForClient(devStore.cursorIndexConfig),
        })
      );
      return;
    }

    if (url === "/api/integrations/cursor-index/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const validationErrors = validateCursorIndexPatch(parsed);
          if (validationErrors.length) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: validationErrors[0] }));
            return;
          }
          devStore.cursorIndexConfig = normalizeCursorIndexConfig({
            ...devStore.cursorIndexConfig,
            ...Object.fromEntries(
              Object.entries(parsed).filter(([, value]) => value !== undefined)
            ),
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
          });
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeCursorIndexConfigForClient(devStore.cursorIndexConfig),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/reindex/config" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          config: sanitizeReindexConfigForClient(devStore.cursorIndexConfig),
        })
      );
      return;
    }

    if (url === "/api/integrations/reindex/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Request body must be a JSON object" }));
            return;
          }
          if (
            parsed.reindexWritePolicy !== undefined &&
            parsed.reindexWritePolicy !== "live" &&
            parsed.reindexWritePolicy !== "quit-first"
          ) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "reindexWritePolicy must be live or quit-first" }));
            return;
          }
          devStore.cursorIndexConfig = normalizeCursorIndexConfig({
            ...devStore.cursorIndexConfig,
            indexEnabled:
              typeof parsed.reindexEnabled === "boolean"
                ? parsed.reindexEnabled
                : devStore.cursorIndexConfig.indexEnabled,
            indexWritePolicy:
              parsed.reindexWritePolicy === "live" || parsed.reindexWritePolicy === "quit-first"
                ? parsed.reindexWritePolicy
                : devStore.cursorIndexConfig.indexWritePolicy,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
          });
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeReindexConfigForClient(devStore.cursorIndexConfig),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/stats-refresh/config" && req.method === "GET") {
      readStatsLiveCache(devFunctionsEnv())
        .then((cache) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeStatsRefreshConfigForClient(devStore.statsRefreshConfig),
              cache: cache
                ? {
                    refreshedAt: cache.refreshedAt,
                    displayTotal: cache.downloads?.displayTotal ?? null,
                    verified: cache.downloads?.verified ?? false,
                    syncStatus: cache.marketplaceSync?.syncStatus ?? null,
                  }
                : null,
            })
          );
        })
        .catch((err) => {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Failed to load stats refresh config" }));
        });
      return;
    }

    if (url === "/api/integrations/stats-refresh/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const interval = Number(parsed.intervalMinutes ?? devStore.statsRefreshConfig.intervalMinutes);
          devStore.statsRefreshConfig = {
            ...devStore.statsRefreshConfig,
            enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : devStore.statsRefreshConfig.enabled,
            intervalMinutes: Number.isFinite(interval)
              ? Math.min(60, Math.max(1, Math.round(interval)))
              : devStore.statsRefreshConfig.intervalMinutes,
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
          };
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              config: sanitizeStatsRefreshConfigForClient(devStore.statsRefreshConfig),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/cron-jobs/config" && req.method === "GET") {
      readStatsLiveCache(devFunctionsEnv())
        .then((cache) => {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              githubJobs: GITHUB_CRON_JOBS,
              managedJobs: MANAGED_CRON_JOBS,
              statsRefresh: sanitizeStatsRefreshConfigForClient(devStore.statsRefreshConfig),
              discordDigest: sanitizeDiscordDigestConfigForClient(devStore.discordDigestConfig),
              cache: cache
                ? {
                    refreshedAt: cache.refreshedAt,
                    displayTotal: cache.downloads?.displayTotal ?? null,
                    verified: cache.downloads?.verified ?? false,
                    syncStatus: cache.marketplaceSync?.syncStatus ?? null,
                  }
                : null,
            })
          );
        })
        .catch((err) => {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Failed to load cron config" }));
        });
      return;
    }

    if (url === "/api/integrations/cron-jobs/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          if (parsed.statsRefresh) {
            const interval = Number(
              parsed.statsRefresh.intervalMinutes ?? devStore.statsRefreshConfig.intervalMinutes
            );
            devStore.statsRefreshConfig = {
              ...devStore.statsRefreshConfig,
              enabled:
                typeof parsed.statsRefresh.enabled === "boolean"
                  ? parsed.statsRefresh.enabled
                  : devStore.statsRefreshConfig.enabled,
              intervalMinutes: Number.isFinite(interval)
                ? Math.min(60, Math.max(1, Math.round(interval)))
                : devStore.statsRefreshConfig.intervalMinutes,
              updatedAt: new Date().toISOString(),
              updatedBy: "dev@local",
            };
          }
          if (parsed.discordDigest) {
            const interval = Number(
              parsed.discordDigest.intervalMinutes ?? devStore.discordDigestConfig.intervalMinutes
            );
            devStore.discordDigestConfig = {
              ...devStore.discordDigestConfig,
              enabled:
                typeof parsed.discordDigest.enabled === "boolean"
                  ? parsed.discordDigest.enabled
                  : devStore.discordDigestConfig.enabled,
              intervalMinutes: Number.isFinite(interval)
                ? Math.min(10080, Math.max(60, Math.round(interval)))
                : devStore.discordDigestConfig.intervalMinutes,
              refreshBeforeSend:
                typeof parsed.discordDigest.refreshBeforeSend === "boolean"
                  ? parsed.discordDigest.refreshBeforeSend
                  : devStore.discordDigestConfig.refreshBeforeSend,
              includeChangelog:
                typeof parsed.discordDigest.includeChangelog === "boolean"
                  ? parsed.discordDigest.includeChangelog
                  : devStore.discordDigestConfig.includeChangelog,
              updatedAt: new Date().toISOString(),
              updatedBy: "dev@local",
            };
          }
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              statsRefresh: sanitizeStatsRefreshConfigForClient(devStore.statsRefreshConfig),
              discordDigest: sanitizeDiscordDigestConfigForClient(devStore.discordDigestConfig),
            })
          );
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/discord/digest/test" && req.method === "POST") {
      runDiscordDigest(devFunctionsEnv(), { triggeredBy: "dev@local", force: true })
        .then((result) => {
          res.setHeader("Content-Type", "application/json");
          if (result.skipped && result.reason === "no_webhook") {
            res.statusCode = 409;
            res.end(
              JSON.stringify({
                ok: false,
                skipped: true,
                reason: result.reason,
                error: result.error,
              })
            );
            return;
          }
          if (!result.ok) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: result.error ?? "Discord digest failed" }));
            return;
          }
          res.end(
            JSON.stringify({
              ok: true,
              durationMs: result.durationMs ?? null,
              displayTotal: result.displayTotal ?? null,
              syncStatus: result.syncStatus ?? null,
            })
          );
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Discord digest failed" }));
        });
      return;
    }

    if (url === "/api/stats/refresh" && req.method === "POST") {
      runStatsRefresh(devFunctionsEnv(), { triggeredBy: "dev@local", force: true })
        .then((result) => {
          res.setHeader("Content-Type", "application/json");
          if (result.skipped) {
            res.statusCode = 409;
            res.end(JSON.stringify({ ok: false, ...result }));
            return;
          }
          res.end(
            JSON.stringify({
              ok: true,
              durationMs: result.durationMs,
              refreshedAt: result.snapshot?.refreshedAt,
              displayTotal: result.snapshot?.downloads?.displayTotal ?? null,
              syncStatus: result.snapshot?.marketplaceSync?.syncStatus ?? null,
            })
          );
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: err.message || "Refresh failed" }));
        });
      return;
    }

    if (url === "/api/community/config" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          devStore.communityConfig = {
            ...devStore.communityConfig,
            featuredDiscussionUrls: Array.isArray(parsed.featuredDiscussionUrls)
              ? parsed.featuredDiscussionUrls.map(String).slice(0, 20)
              : devStore.communityConfig.featuredDiscussionUrls,
            defaultCategorySlug: String(parsed.defaultCategorySlug ?? devStore.communityConfig.defaultCategorySlug).slice(0, 64),
            collaborateUrl: String(parsed.collaborateUrl ?? devStore.communityConfig.collaborateUrl).slice(0, 512),
            updatedAt: new Date().toISOString(),
            updatedBy: "dev@local",
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, config: devStore.communityConfig }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/tags" && req.method === "GET") {
      fetchGitHubTags()
        .then((result) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/discussions" && req.method === "GET") {
      fetchDiscussions()
        .then((data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/discussions" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const title = String(parsed.title ?? "").trim();
          const markdown = String(parsed.body ?? "").trim();
          const categoryId = String(parsed.categoryId ?? "").trim();
          if (!title || !markdown || !categoryId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "title, body, and categoryId are required" }));
            return;
          }
          if (!loadGithubToken()) {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: "GITHUB_TOKEN not configured" }));
            return;
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: true,
            discussion: {
              id: `dev-${Date.now()}`,
              url: `https://github.com/${GITHUB_REPO}/discussions`,
              title,
            },
          }));
          logDevActivity(req, 200);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    if (url === "/api/sync/status" && req.method === "GET") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      fetch("https://api.github.com/zen", { headers: githubHeaders(), signal: controller.signal })
        .then((gh) => {
          clearTimeout(timer);
          const now = Date.now();
          const refreshedAt = devStore.statsLiveCache?.refreshedAt ?? null;
          const refreshedMs = refreshedAt ? Date.parse(refreshedAt) : NaN;
          const ageSeconds =
            refreshedAt && !Number.isNaN(refreshedMs)
              ? Math.max(0, Math.round((now - refreshedMs) / 1000))
              : null;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: gh.ok,
            overall: gh.ok ? "online" : "offline",
            checkedAt: new Date(now).toISOString(),
            github: { ok: gh.ok },
            adminKv: { configured: true },
            adminD1: { configured: false, ok: false, error: "ADMIN_D1 binding missing" },
            mail: {
              configured: true,
              transport: "dev-simulated",
              relayBound: false,
              resendConfigured: false,
            },
            stats: {
              enabled: true,
              intervalMinutes: devStore.statsRefreshConfig?.intervalMinutes ?? 5,
              lastRunAt: devStore.statsRefreshConfig?.lastRunAt ?? null,
              lastRunOk: devStore.statsRefreshConfig?.lastRunOk ?? null,
              lastRunError: devStore.statsRefreshConfig?.lastRunError ?? null,
              kvQuotaHit: false,
              cache: {
                refreshedAt,
                ageSeconds,
                fresh: ageSeconds != null && ageSeconds < 600,
                displayTotal: devStore.statsLiveCache?.downloads?.displayTotal ?? null,
                syncStatus: devStore.statsLiveCache?.marketplaceSync?.syncStatus ?? null,
              },
            },
            hint: null,
          }));
        })
        .catch(() => {
          clearTimeout(timer);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: false,
            overall: "offline",
            checkedAt: new Date().toISOString(),
            github: { ok: false },
            adminKv: { configured: true },
            adminD1: { configured: false, ok: false, error: "ADMIN_D1 binding missing" },
            mail: { configured: true, transport: "dev-simulated" },
            stats: {
              enabled: true,
              intervalMinutes: 5,
              lastRunAt: null,
              lastRunOk: null,
              lastRunError: null,
              kvQuotaHit: false,
              cache: { refreshedAt: null, ageSeconds: null, fresh: false, displayTotal: null, syncStatus: null },
            },
            hint: null,
          }));
        });
      return;
    }

    if (url === "/api/health" && req.method === "GET") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      fetch("https://api.github.com/zen", { headers: githubHeaders(), signal: controller.signal })
        .then((gh) => {
          clearTimeout(timer);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: gh.ok,
            checks: { github: gh.ok, timestamp: new Date().toISOString() },
            firebaseProject: "cursor-curse-by-lorapok",
            firebaseConfigured: Boolean(process.env.VITE_FIREBASE_API_KEY),
            adminD1Configured: false,
            adminD1Ok: false,
            githubTokenConfigured: Boolean(loadGithubToken()),
            adminKvConfigured: true,
            mailConfigured: true,
            mailTransport: "dev-simulated",
            discordConfigured: Boolean(devStore.discordConfig.deploymentWebhookUrl),
            feedbackDiscordConfigured: Boolean(devStore.discordConfig.feedbackWebhookUrl),
            communityDiscordConfigured: Boolean(devStore.discordConfig.communityWebhookUrl),
            siteDataUrl: "/site-data.json",
          }));
        })
        .catch(() => {
          clearTimeout(timer);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: false,
            checks: { github: false, timestamp: new Date().toISOString() },
            firebaseProject: "cursor-curse-by-lorapok",
            firebaseConfigured: Boolean(process.env.VITE_FIREBASE_API_KEY),
            adminD1Configured: false,
            adminD1Ok: false,
            githubTokenConfigured: Boolean(loadGithubToken()),
            adminKvConfigured: true,
            mailConfigured: true,
            mailTransport: "dev-simulated",
            discordConfigured: Boolean(devStore.discordConfig.deploymentWebhookUrl),
            feedbackDiscordConfigured: Boolean(devStore.discordConfig.feedbackWebhookUrl),
            communityDiscordConfigured: Boolean(devStore.discordConfig.communityWebhookUrl),
            siteDataUrl: "/site-data.json",
          }));
        });
      return;
    }

    if (url === "/api/admins" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ emails: readDevAdminEmails(), source: "local-file" }));
      return;
    }

    if (url === "/api/admins" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const email = String(parsed.email ?? "").trim().toLowerCase();
          const action = parsed.action ?? "add";
          if (!email) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "email is required" }));
            return;
          }
          let emails = readDevAdminEmails();
          if (action === "remove") emails = emails.filter((e) => e !== email);
          else if (!emails.includes(email)) emails.push(email);
          emails = writeDevAdminEmails(emails);
          const role = String(parsed.role ?? "admin").trim().toLowerCase();
          const env = devFunctionsEnv();
          const actor = "dev@local";
          void (async () => {
            try {
              const rbacMap = await readRbacMap(env);
              const previousExplicit = rbacMap[email] ?? null;
              const previousEffective = await resolveAdminRole(env, email, false);
              if (action === "remove") {
                await removeAdminRole(env, email);
                await logAllowlistRemove(env, {
                  actor,
                  target: email,
                  previousRole: previousExplicit ?? previousEffective,
                });
              } else {
                await assignAdminRole(env, email, role);
                await logAllowlistAdd(env, { actor, target: email, role });
              }
            } catch (err) {
              console.warn("dev rbac sync failed:", err);
            }
          })();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, emails, action, role: action === "remove" ? null : role }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
        }
      });
      return;
    }

    if (url.startsWith("/api/auth/invite-check") && req.method === "GET") {
      const parsedUrl = new URL(req.url ?? "", "http://localhost");
      const email = String(parsedUrl.searchParams.get("email") ?? "").trim().toLowerCase();
      const master = resolveDevMasterEmail();
      const allowed = new Set([master, ...readDevAdminEmails()]);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ invited: Boolean(email && allowed.has(email)) }));
      return;
    }

    if (url === "/api/auth/rbac" && req.method === "GET") {
      void (async () => {
        const snapshot = await buildRbacTeamSnapshot(devFunctionsEnv());
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, ...snapshot }));
      })().catch((err) => {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
      });
      return;
    }

    if (url === "/api/auth/rbac" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        void (async () => {
          const parsed = JSON.parse(body || "{}");
          const email = String(parsed.email ?? "").trim().toLowerCase();
          const env = devFunctionsEnv();
          const actor = "dev@local";
          const rbacMap = await readRbacMap(env);
          const previousExplicit = rbacMap[email] ?? null;
          const previousEffective = await resolveAdminRole(env, email, false);
          if (parsed.clear === true) {
            await removeAdminRole(env, email);
            await logRoleClear(env, {
              actor,
              target: email,
              previousRole: previousExplicit ?? previousEffective,
            });
          } else {
            const role = String(parsed.role ?? "admin").trim().toLowerCase();
            await assignAdminRole(env, email, role);
            await logRoleAssignment(env, {
              actor,
              target: email,
              role,
              previousRole: previousExplicit ?? (previousEffective !== role ? previousEffective : null),
            });
          }
          const snapshot = await buildRbacTeamSnapshot(env);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, ...snapshot }));
        })().catch((err) => {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
        });
      });
      return;
    }

    if (url === "/api/auth/me" && req.method === "GET") {
      void (async () => {
        const email = resolveDevMasterEmail();
        const ctx = await buildAdminAuthContext(devFunctionsEnv(), email, true);
        const profile = devStore.userProfiles[email] ?? null;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            ok: true,
            user: {
              email,
              role: ctx.role,
              permissions: ctx.permissions,
              isMaster: true,
              profile: sanitizeProfileForClient(profile),
            },
          })
        );
      })().catch((err) => {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
      });
      return;
    }

    if (url === "/api/auth/profile" && req.method === "GET") {
      const email = resolveDevMasterEmail();
      const profile = devStore.userProfiles[email] ?? null;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, profile: sanitizeProfileForClient(profile) }));
      return;
    }

    if (url === "/api/auth/profile" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const email = resolveDevMasterEmail();
          const current = devStore.userProfiles[email] ?? {};
          const next = {
            ...current,
            email,
            updatedAt: new Date().toISOString(),
          };
          if (parsed.displayNameOverride !== undefined) {
            next.displayNameOverride = String(parsed.displayNameOverride ?? "").trim().slice(0, 80);
          }
          if (parsed.clearPin === true) {
            next.pinHash = "";
            next.pinSalt = "";
          } else if (parsed.pinHash && parsed.pinSalt) {
            next.pinHash = String(parsed.pinHash);
            next.pinSalt = String(parsed.pinSalt);
          }
          devStore.userProfiles[email] = next;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, profile: sanitizeProfileForClient(next) }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
        }
      });
      return;
    }

    if (url === "/api/deploy-infra" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        triggerInfraDeploy(JSON.parse(body || "{}"))
          .then((result) => {
            logDevActivity(req, 200);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          })
          .catch((err) => {
            const code = err.message.includes("GITHUB_TOKEN") ? 500 : 502;
            logDevActivity(req, code);
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          });
      });
      return;
    }

    if (url === "/api/deploy" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        triggerDeployment(JSON.parse(body || "{}"))
          .then((result) => {
            logDevActivity(req, 200);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          })
          .catch((err) => {
            const code = err.message.includes("GITHUB_TOKEN") ? 500 : 502;
            logDevActivity(req, code);
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          });
      });
      return;
    }

    if (url === "/api/rollback" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        triggerRollback(JSON.parse(body || "{}"))
          .then((result) => {
            logDevActivity(req, 200);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ...result, message: "Rollback triggered" }));
          })
          .catch((err) => {
            const code = err.message.includes("GITHUB_TOKEN") ? 500 : 502;
            logDevActivity(req, code);
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          });
      });
      return;
    }

    if (url === "/api/release" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        triggerRelease(JSON.parse(body || "{}"))
          .then((result) => {
            logDevActivity(req, 200);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          })
          .catch((err) => {
            const code = err.message.includes("GITHUB_TOKEN") ? 500 : 502;
            logDevActivity(req, code);
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          });
      });
      return;
    }

    if (url === "/api/notice" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      const active = devStore.notices.find((n) => n.enabled) ?? { ...devStore.notice, enabled: false };
      res.end(JSON.stringify(active));
      return;
    }

    if (url === "/api/notices" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      const noticeUrl = new URL(req.url ?? "/", "http://localhost");
      if (noticeUrl.searchParams.get("templates") === "1") {
        getNoticeTemplates({})
          .then((templates) => {
            res.end(JSON.stringify({ templates }));
          })
          .catch((err) => {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to load templates" }));
          });
        return;
      }
      const changelogTag = noticeUrl.searchParams.get("tag")?.trim();
      if (noticeUrl.searchParams.get("changelogDraft") === "1") {
        if (!changelogTag) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "tag query param is required" }));
          return;
        }
        try {
          const markdown = readFileSync(resolve(repoRoot, "CHANGELOG.md"), "utf8");
          const draft = buildNoticeDraftFromChangelog(markdown, changelogTag);
          const existing = devStore.notices.find((n) => n.id === changelogNoticeId(changelogTag));
          res.end(JSON.stringify({ draft, exists: Boolean(existing), existing: existing ?? null }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Changelog draft failed" }));
        }
        return;
      }
      const active = devStore.notices.find((n) => n.enabled) ?? null;
      res.end(JSON.stringify({ items: devStore.notices, active }));
      return;
    }

    if (url === "/api/notices" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const notice = {
            id: crypto.randomUUID(),
            source: "admin",
            enabled: Boolean(parsed.enabled),
            type: "development",
            title: String(parsed.title ?? "").trim(),
            message: String(parsed.message ?? "").trim(),
            shortMessage: String(parsed.shortMessage ?? "").trim(),
            severity: String(parsed.severity ?? "info").trim() || "info",
            feedbackUrl: String(parsed.feedbackUrl ?? "").trim(),
            collaborateUrl: String(parsed.collaborateUrl ?? "").trim(),
            updatedAt: new Date().toISOString(),
            dismissible: parsed.dismissible !== false,
          };
          if (notice.enabled) {
            devStore.notices = devStore.notices.map((n) => ({ ...n, enabled: false }));
          }
          devStore.notices.unshift(notice);
          devStore.notice = notice.enabled ? notice : (devStore.notices.find((n) => n.enabled) ?? notice);
          logDevActivity(req, 200);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, notice, items: devStore.notices }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid payload" }));
        }
      });
      return;
    }

    if (url === "/api/notices" && req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const id = String(parsed.id ?? "");
          let index = devStore.notices.findIndex((n) => n.id === id);
          if (index < 0 && typeof parsed.enabled === "boolean" && Object.keys(parsed).every((k) => ["id", "enabled"].includes(k))) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Notice not found" }));
            return;
          }
          if (index < 0) {
            const notice = {
              id,
              source: parsed.source ?? "admin",
              enabled: Boolean(parsed.enabled),
              type: String(parsed.type ?? "development").trim() || "development",
              title: String(parsed.title ?? "").trim(),
              message: String(parsed.message ?? "").trim(),
              shortMessage: String(parsed.shortMessage ?? "").trim(),
              severity: String(parsed.severity ?? "info").trim() || "info",
              feedbackUrl: String(parsed.feedbackUrl ?? "").trim(),
              collaborateUrl: String(parsed.collaborateUrl ?? "").trim(),
              updatedAt: new Date().toISOString(),
              dismissible: parsed.dismissible !== false,
            };
            if (notice.enabled) {
              devStore.notices = devStore.notices.map((n) => ({ ...n, enabled: false }));
            }
            devStore.notices.unshift(notice);
            index = 0;
          }
          if (typeof parsed.enabled === "boolean" && Object.keys(parsed).every((k) => ["id", "enabled"].includes(k))) {
            devStore.notices = devStore.notices.map((n) => ({
              ...n,
              enabled: parsed.enabled ? n.id === id : n.id === id ? false : n.enabled,
              updatedAt: n.id === id ? new Date().toISOString() : n.updatedAt,
            }));
          } else {
            devStore.notices[index] = { ...devStore.notices[index], ...parsed, id, updatedAt: new Date().toISOString() };
            if (devStore.notices[index].enabled) {
              devStore.notices = devStore.notices.map((n) => (n.id === id ? n : { ...n, enabled: false }));
            }
          }
          const active = devStore.notices.find((n) => n.enabled) ?? null;
          devStore.notice = active ?? { ...devStore.notices[0], enabled: false };
          logDevActivity(req, 200);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, notice: devStore.notices.find((n) => n.id === id), items: devStore.notices }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Invalid payload" }));
        }
      });
      return;
    }

    if (url === "/api/notices" && req.method === "DELETE") {
      const id = new URL(req.url ?? "/", "http://localhost").searchParams.get("id");
      const before = devStore.notices.length;
      devStore.notices = devStore.notices.filter((n) => n.id !== id);
      if (devStore.notices.length === before) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Notice not found" }));
        return;
      }
      const active = devStore.notices.find((n) => n.enabled) ?? null;
      devStore.notice = active ?? { enabled: false, title: "", message: "", shortMessage: "", severity: "info", feedbackUrl: "", collaborateUrl: "", updatedAt: new Date().toISOString(), dismissible: true };
      logDevActivity(req, 200);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, items: devStore.notices, notice: devStore.notice }));
      return;
    }

    if (url === "/api/notice" && (req.method === "POST" || req.method === "PUT")) {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const notice = {
            id: crypto.randomUUID(),
            source: "admin",
            enabled: parsed.enabled !== false,
            type: "development",
            title: String(parsed.title ?? "").trim(),
            message: String(parsed.message ?? "").trim(),
            shortMessage: String(parsed.shortMessage ?? parsed.short_message ?? "").trim(),
            severity: String(parsed.severity ?? "info").trim() || "info",
            feedbackUrl: String(parsed.feedbackUrl ?? parsed.feedback_url ?? "").trim(),
            collaborateUrl: String(parsed.collaborateUrl ?? parsed.collaborate_url ?? "").trim(),
            updatedAt: new Date().toISOString(),
            dismissible: parsed.dismissible !== false,
          };
          devStore.notices = devStore.notices.map((n) => ({ ...n, enabled: false }));
          devStore.notices.unshift(notice);
          devStore.notice = notice;
          logDevActivity(req, 200);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, notice, items: devStore.notices }));
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid payload" }));
        }
      });
      return;
    }

    if (url === "/api/notice" && req.method === "DELETE") {
      devStore.notices = devStore.notices.map((n) => ({ ...n, enabled: false }));
      devStore.notice = { ...devStore.notice, enabled: false, updatedAt: new Date().toISOString() };
      logDevActivity(req, 200);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, notice: devStore.notice, items: devStore.notices }));
      return;
    }

    if ((url === "/api/notice" || url === "/api/notices") && req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    if (url === "/api/subscribers" && req.method === "GET") {
      readSubscribers(devKv)
        .then((items) => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ items, stats: subscriberStats(items) }));
        })
        .catch((error) => {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message || "Failed to load subscribers" }));
        });
      return;
    }

    if (url === "/api/subscribers/broadcast" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const result = await broadcastToSubscribers(
            { ADMIN_KV: devKv },
            {
              title: parsed.title,
              message: parsed.message ?? parsed.shortMessage,
              severity: parsed.severity,
              feedbackUrl: parsed.feedbackUrl,
              sentBy: "dev@local",
            }
          );
          res.statusCode = result.error ? 400 : 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: error.message || "Broadcast failed" }));
        }
      });
      return;
    }

    if (url === "/api/feedback" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          if (parsed.probe === true) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ ok: true, probed: true, message: "Probe OK" }));
            return;
          }
          const result = await submitProductFeedback({ ADMIN_KV: devKv }, {
            kind: parsed.kind,
            message: parsed.message,
            source: parsed.source,
            version: parsed.version,
            editor: parsed.editor,
            installId: parsed.installId ?? parsed.install_id,
            email: parsed.email,
          });
          res.statusCode = result.ok ? 200 : (result.status ?? 400);
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(JSON.stringify(result.ok ? result : { error: result.error }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(JSON.stringify({ error: error.message || "Feedback failed" }));
        }
      });
      return;
    }

    if (url === "/api/feedback" && req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (url === "/api/subscribe" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const email = String(parsed.email ?? "").trim().toLowerCase();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ error: "Valid email is required" }));
            return;
          }
          if (parsed.probe === true) {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ ok: true, probed: true, message: "Probe OK" }));
            return;
          }
          if (parsed.consent !== true && parsed.consent !== "true") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ error: "Consent is required to subscribe" }));
            return;
          }
          const upsert = await upsertSubscriber(devKv, {
            email,
            source: String(parsed.source ?? "website"),
            installId: parsed.installId ?? null,
          });
          if (!upsert.ok) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ error: upsert.error || "Subscribe failed" }));
            return;
          }
          const mailEntry = {
            id: crypto.randomUUID(),
            direction: "outbound",
            from: "cursor.monitor@lorapok.tech",
            to: email,
            subject: "Subscribed to Cursor Curse Monitor updates",
            text: `Thanks for subscribing, ${email}.`,
            status: "sent",
            category: "subscribe",
            ts: new Date().toISOString(),
            sentBy: null,
            error: null,
            read: false,
          };
          devStore.mailbox.unshift(mailEntry);
          devStore.systemLogs.unshift({
            id: crypto.randomUUID(),
            ts: new Date().toISOString(),
            level: "info",
            source: "mail",
            message: `Email sent to ${email}`,
            email: null,
            meta: { category: "subscribe" },
          });
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(
            JSON.stringify({
              ok: true,
              emailed: true,
              message: "You're subscribed! (Dev mode — no email sent locally.)",
            })
          );
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(JSON.stringify({ error: "Invalid payload" }));
        }
      });
      return;
    }

    if (url === "/api/subscribe" && req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.end();
      return;
    }

    if (url.startsWith("/api/logs") && req.method === "GET") {
      const query = new URL(req.url ?? "", "http://localhost");
      const page = Math.max(1, Number.parseInt(query.searchParams.get("page") ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(query.searchParams.get("limit") ?? "25", 10) || 25));
      const type = query.searchParams.get("type");
      const source = query.searchParams.get("source");
      const emailFilter = query.searchParams.get("email")?.trim().toLowerCase();
      const q = query.searchParams.get("q")?.trim().toLowerCase();
      void (async () => {
        const scatterSystem = await readSystemLogs(devFunctionsEnv());
        const merged = [
          ...devStore.activity.map((row) => ({
            id: `api-${row.ts}-${row.path}`,
            type: "api",
            ts: row.ts,
            level: row.status >= 500 ? "error" : row.status >= 400 ? "warn" : "info",
            source: "api",
            method: row.method,
            path: row.path,
            status: row.status,
            latencyMs: row.latencyMs,
            email: row.email,
            message: `${row.method} ${row.path} → ${row.status}`,
          })),
          ...devStore.mailbox.map((row) => ({
            id: `mail-${row.id}`,
            type: "mail",
            ts: row.ts,
            level: row.status === "failed" ? "error" : "info",
            source: "mailbox",
            status: row.status,
            email: row.to,
            subject: row.subject,
            message: `${row.direction} ${row.category}: ${row.subject}`,
          })),
          ...scatterSystem.map((row) => ({
            id: `sys-${row.id}`,
            type: "system",
            ts: row.ts,
            level: row.level,
            source: row.source,
            email: row.email,
            message: row.message,
          })),
          ...devStore.systemLogs.map((row) => ({
            id: `sys-${row.id}`,
            type: "system",
            ts: row.ts,
            level: row.level,
            source: row.source,
            email: row.email,
            message: row.message,
          })),
        ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        let filtered = merged;
        if (type && type !== "all") filtered = filtered.filter((r) => r.type === type);
        if (source) filtered = filtered.filter((r) => String(r.source ?? "") === source);
        if (emailFilter) {
          filtered = filtered.filter((r) => String(r.email ?? "").toLowerCase().includes(emailFilter));
        }
        if (q) {
          filtered = filtered.filter((r) => String(r.message ?? "").toLowerCase().includes(q));
        }
        const start = (page - 1) * limit;
        logDevActivity(req, 200);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          items: filtered.slice(start, start + limit),
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
          counts: {
            api: devStore.activity.length,
            mail: devStore.mailbox.length,
            system: scatterSystem.length + devStore.systemLogs.length,
          },
        }));
      })().catch((err) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Server error" }));
      });
      return;
    }

    if (url.startsWith("/api/mailbox") && req.method === "GET") {
      if (new URL(req.url ?? "/", "http://localhost").searchParams.get("templates") === "1") {
        res.setHeader("Content-Type", "application/json");
        getMailTemplates({})
          .then((templates) => {
            res.end(JSON.stringify({ templates }));
          })
          .catch((err) => {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to load templates" }));
          });
        return;
      }
      const query = new URL(req.url ?? "", "http://localhost");
      const page = Math.max(1, Number.parseInt(query.searchParams.get("page") ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(query.searchParams.get("limit") ?? "25", 10) || 25));
      const start = (page - 1) * limit;
      const items = devStore.mailbox.slice(start, start + limit);
      logDevActivity(req, 200);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        items,
        page,
        limit,
        total: devStore.mailbox.length,
        totalPages: Math.max(1, Math.ceil(devStore.mailbox.length / limit)),
        stats: {
          total: devStore.mailbox.length,
          unread: devStore.mailbox.filter((m) => !m.read).length,
          outbound: devStore.mailbox.filter((m) => m.direction === "outbound").length,
          inbound: devStore.mailbox.filter((m) => m.direction === "inbound").length,
          failed: devStore.mailbox.filter((m) => m.status === "failed").length,
        },
        transport: { configured: true, transport: "dev-simulated" },
      }));
      return;
    }

    if (url === "/api/mailbox" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const action = parsed.action ?? "send";
          if (action === "mark-read") {
            const item = devStore.mailbox.find((m) => m.id === parsed.id);
            if (item) item.read = true;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, message: item }));
            return;
          }
          if (action === "testmail-probe") {
            const tag = `ccm-mailbox-${Date.now()}`;
            const namespace = String(process.env.TESTMAIL_NAMESPACE ?? "dev").trim();
            const to = `${namespace}.${tag}@inbox.testmail.app`;
            const entry = {
              id: crypto.randomUUID(),
              direction: "outbound",
              from: "cursor.monitor@lorapok.tech",
              to,
              subject: "Subscribed to Cursor Curse Monitor updates",
              text: `Thanks for subscribing, ${to}.`,
              status: "sent",
              category: "subscribe",
              ts: new Date().toISOString(),
              sentBy: "dev@local",
              error: null,
              read: false,
            };
            devStore.mailbox.unshift(entry);
            logDevActivity(req, 200);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              ok: true,
              emailed: true,
              tag,
              to,
              since: Date.now() - 5000,
              transport: "dev-simulated",
              message: `Dev: subscribe probe queued to ${to}`,
              mailboxId: entry.id,
            }));
            return;
          }
          const to = String(parsed.to ?? "dev@local").trim().toLowerCase();
          const subject = action === "test"
            ? "Cursor Curse Monitor — mailbox test"
            : String(parsed.subject ?? "Dev compose");
          const text = action === "test"
            ? "Mailbox test (dev mode)"
            : String(parsed.text ?? "");
          const entry = {
            id: crypto.randomUUID(),
            direction: "outbound",
            from: "cursor.monitor@lorapok.tech",
            to,
            subject,
            text,
            status: "sent",
            category: action === "test" ? "test" : "compose",
            ts: new Date().toISOString(),
            sentBy: "dev@local",
            error: null,
            read: false,
          };
          devStore.mailbox.unshift(entry);
          logDevActivity(req, 200);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, emailed: true, message: `Dev: message queued to ${to}`, mailboxId: entry.id }));
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid payload" }));
        }
      });
      return;
    }

    if (url === "/api/integrations/mail/sync" && req.method === "POST") {
      logDevActivity(req, 200);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        message: "Dev: mail sync would dispatch deploy-infra (enable-mail + Pages redeploy).",
        transport: { configured: true, transport: "dev-simulated", relayBound: true, resendConfigured: false },
        recommendations: ["In production, Sync up runs GitHub Actions deploy-infra with deploy_admin=true."],
        workflow: "ci-cd.yml",
        deployAdmin: true,
        deployWebsite: false,
      }));
      return;
    }

    if (url.startsWith("/api/integrations/mail/testmail") && req.method === "GET") {
      const query = new URL(req.url ?? "", "http://localhost");
      const tag = String(query.searchParams.get("tag") ?? "").trim();
      if (!tag) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "tag query parameter is required" }));
        return;
      }
      logDevActivity(req, 200);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        tag,
        inbox: `dev.${tag}@inbox.testmail.app`,
        count: 1,
        received: true,
        email: {
          from: "cursor.monitor@lorapok.tech",
          subject: "Subscribed to Cursor Curse Monitor updates",
          preview: "Thanks for subscribing (dev simulated inbox).",
        },
      }));
      return;
    }

    if (url.startsWith("/api/activity") && req.method === "GET") {
      const query = new URL(req.url ?? "", "http://localhost");
      const page = Math.max(1, Number.parseInt(query.searchParams.get("page") ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(query.searchParams.get("limit") ?? "20", 10) || 20));
      const total = devStore.activity.length;
      const start = (page - 1) * limit;
      const items = devStore.activity.slice(start, start + limit);
      logDevActivity(req, 200);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        items,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      }));
      return;
    }

    if (url === "/api/releases" && req.method === "GET") {
      fetchGitHubReleases()
        .then((releases) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ releases }));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/workflows/runs" && req.method === "GET") {
      fetchWorkflowRuns()
        .then((data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url.startsWith("/api/workflows/run-logs") && req.method === "GET") {
      const runId = new URL(req.url ?? "", "http://localhost").searchParams.get("run_id") ?? "0";
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          runId: Number(runId),
          jobs: [{ id: 1, name: "publish", status: "completed", conclusion: "success" }],
          text: `=== publish (dev mock) ===\nRun ${runId}\n✓ Package extension\n✓ Publish Open VSX\n✓ Publish VS Code Marketplace\nDone.`,
        })
      );
      return;
    }

    if (url === "/api/marketplace/sync" && req.method === "GET") {
      fetchMarketplaceSync()
        .then((data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (url === "/api/version/plan" && req.method === "GET") {
      const planUrl = new URL(req.url ?? "", "http://localhost");
      const bumpType = planUrl.searchParams.get("bump") ?? "patch";
      const releaseChannel = planUrl.searchParams.get("channel") ?? "production";
      fetchMarketplaceSync()
        .then((sync) => {
          const plan =
            releaseChannel === "beta"
              ? buildBetaVersionPlan({
                  packageVersion: sync.packageVersion,
                  channels: sync.channels,
                  bumpType: ["patch", "minor", "major"].includes(bumpType) ? bumpType : "patch",
                })
              : buildVersionPlan({
                  packageVersion: sync.packageVersion,
                  channels: sync.channels,
                  bumpType: ["patch", "minor", "major"].includes(bumpType) ? bumpType : "patch",
                });
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              checkedAt: new Date().toISOString(),
              bumpType,
              releaseChannel,
              channels: sync.channels,
              ...plan,
            }),
          );
        })
        .catch((err) => {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    next();
  };
}
