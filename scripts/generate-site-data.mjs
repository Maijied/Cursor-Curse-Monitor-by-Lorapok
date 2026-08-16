#!/usr/bin/env node
/**
 * Generates website/site-data.json from package.json + live GitHub/Open VSX/VS Code Marketplace APIs.
 * Run locally or in GitHub Pages CI so install commands stay up to date.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const REPO = pkg.repository?.url?.match(/github\.com\/([^/]+\/[^/.]+)/)?.[1]
  ?? "Maijied/Cursor-Curse-Monitor-by-Lorapok";
const OVSX_NS = "lorapok-labs";
const OVSX_DUPLICATE_NS = "LorapokLabs";
const VSCE_NS = "LorapokLabs";
const NAME = pkg.name;
const OVSX_EXT_ID = `${OVSX_NS}.${NAME}`;
const VSCE_EXT_ID = `${VSCE_NS}.${NAME}`;

/** Public development notice — shown on website banner and admin reports. */
const DEV_NOTICE = {
  enabled: true,
  type: "development",
  severity: "warning",
  title: "Active Development Notice",
  message:
    "Cursor Curse Monitor is still in active development. Some users may experience conflicts with their Cursor database — we are deeply sorry, especially to Lorapok Labs members and everyone affected. A stable release is targeted soon (expected by tomorrow). Thank you for your support — your feedback helps us improve. Interested in collaborating on Lorapok Labs projects? You're welcome to reach out.",
  shortMessage:
    "Still in development — some users may see Cursor database conflicts. Stable release coming soon. We apologize to everyone affected.",
  feedbackUrl: `https://github.com/${REPO}/issues`,
  collaborateUrl: `https://github.com/${REPO}/discussions`,
  updatedAt: "2026-08-15T00:00:00.000Z",
  dismissible: true,
};

/** First version with safe atomic fallback writes (no full state.vscdb rewrite). */
const SAFE_FALLBACK_SINCE = "0.5.7";

const FALLBACK_MODEL = {
  displayName: "Composer 2.5 (Fast off)",
  modelId: "composer-2.5",
  description: "Free slow-pool fallback when usage limits are reached.",
};

function classifyFallbackStability(version) {
  const v = normalizeVersion(version);
  if (!v) return "unknown";
  if (compareSemver(v, SAFE_FALLBACK_SINCE) >= 0) return "stable";
  if (compareSemver(v, "0.5.0") >= 0) return "unsafe";
  return "legacy";
}

function buildStableFallbackVersions(tags, latestTag) {
  const seen = new Set();
  const rows = [];

  for (const tag of tags) {
    const version = normalizeVersion(tag);
    if (!version || seen.has(version)) continue;
    seen.add(version);
    const stability = classifyFallbackStability(version);
    rows.push({
      tag: tag.startsWith("v") ? tag : `v${tag}`,
      version,
      stability,
      recommended: stability === "stable" && tag.replace(/^v/, "") === normalizeVersion(latestTag),
      vsixUrl: `https://github.com/${REPO}/releases/download/${tag.startsWith("v") ? tag : `v${tag}`}/${NAME}-${version}.vsix`,
      note:
        stability === "stable"
          ? "Safe for fallback model writes"
          : stability === "unsafe"
            ? "May conflict with Cursor database — upgrade to 0.5.7+"
            : "Legacy release — fallback behavior differs",
    });
    if (rows.length >= 12) break;
  }

  return {
    safeSinceVersion: SAFE_FALLBACK_SINCE,
    recommendedVersion: normalizeVersion(latestTag) ?? pkg.version,
    model: FALLBACK_MODEL,
    versions: rows,
  };
}

async function fetchJson(url, retries = 3) {
  const headers = { Accept: "application/json" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 429 && attempt < retries - 1) {
        const waitMs = 1000 * (attempt + 1);
        console.warn(`Rate limited (${url}), retry in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) return null;
      return res.json();
    } catch {
      if (attempt === retries - 1) return null;
    }
  }
  return null;
}

function normalizeVersion(v) {
  return v?.replace(/^v/, "") ?? null;
}

function compareSemver(a, b) {
  if (!a || !b) return 0;
  const pa = normalizeVersion(a).split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = normalizeVersion(b).split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va === vb) continue;
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb));
  }
  return 0;
}

function computeSyncStatus(canonicalVersion, duplicateVersion, targetVersion) {
  const canonical = normalizeVersion(canonicalVersion);
  const duplicate = normalizeVersion(duplicateVersion);
  const target = normalizeVersion(targetVersion);

  if (!canonical) return "missing";
  if (duplicate && compareSemver(duplicate, canonical) > 0) return "duplicate-listing";
  if (compareSemver(canonical, target) < 0) return "drift";
  if (compareSemver(canonical, target) > 0) return "ahead";
  return "synced";
}

function readVisitorStatsFile() {
  const path = join(root, "website", "visitor-stats.json");
  if (!existsSync(path)) {
    return {
      websiteVisits: 0,
      packageClicks: { ovsx: 0, vscode: 0, github: 0, vsix: 0, openvsxDuplicate: 0 },
      totalEngagement: 0,
      updatedAt: null,
    };
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { websiteVisits: 0, packageClicks: {}, totalEngagement: 0, updatedAt: null };
  }
}

async function readVisitorStats() {
  const fileStats = readVisitorStatsFile();
  const socialPath = join(root, "website", "social.json");
  let statsUrl = process.env.ANALYTICS_STATS_URL || "";
  if (!statsUrl && existsSync(socialPath)) {
    try {
      const social = JSON.parse(readFileSync(socialPath, "utf8"));
      statsUrl = social?.api?.analyticsStats || "";
    } catch {
      /* ignore */
    }
  }
  if (!statsUrl) return fileStats;
  try {
    const live = await fetchJson(statsUrl);
    if (live && typeof live.websiteVisits === "number") {
      const merged = {
        websiteVisits: live.websiteVisits ?? 0,
        packageClicks: { ...(fileStats.packageClicks ?? {}), ...(live.packageClicks ?? {}) },
        totalEngagement: live.totalEngagement ?? 0,
        updatedAt: live.updatedAt ?? new Date().toISOString(),
      };
      try {
        writeFileSync(
          join(root, "website", "visitor-stats.json"),
          JSON.stringify(merged, null, 2) + "\n"
        );
      } catch {
        /* non-fatal */
      }
      return merged;
    }
  } catch {
    /* fall back to file when API unavailable in CI */
  }
  return fileStats;
}

async function githubTags() {
  const data = await fetchJson(`https://api.github.com/repos/${REPO}/tags?per_page=30`);
  if (!Array.isArray(data)) return [];
  return data.map((t) => t.name).filter(Boolean);
}

async function githubLatestRelease() {
  const data = await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!data?.tag_name) return null;
  const tag = data.tag_name.replace(/^v/, "");
  const vsix = (data.assets ?? []).find((a) => a.name?.endsWith(".vsix"));
  return {
    tag: data.tag_name,
    version: tag,
    url: data.html_url,
    vsixName: vsix?.name ?? `${NAME}-${tag}.vsix`,
    vsixUrl: vsix?.browser_download_url ?? null,
    vsixDownloadCount: vsix?.download_count ?? 0,
    publishedAt: data.published_at,
  };
}

async function githubReleaseDownloadTotal() {
  const releases = await fetchJson(`https://api.github.com/repos/${REPO}/releases?per_page=100`);
  if (!Array.isArray(releases)) return 0;
  return releases.reduce((sum, rel) => {
    const assets = rel.assets ?? [];
    return sum + assets.reduce((a, asset) => a + (asset.download_count ?? 0), 0);
  }, 0);
}

async function ovsxLatest(namespace) {
  const data = await fetchJson(`https://open-vsx.org/api/${namespace}/${NAME}`);
  if (!data?.version) return null;
  return {
    namespace,
    version: data.version,
    url: `https://open-vsx.org/extension/${namespace}/${NAME}`,
    downloadable: data.downloadable !== false,
    downloadCount: data.downloadCount ?? 0,
    installQuery: `${namespace}.${NAME}`,
  };
}

async function vsceLatest() {
  const body = {
    filters: [{
      criteria: [{ filterType: 7, value: `${VSCE_NS}.${NAME}` }],
      pageSize: 1,
      pageNumber: 1,
    }],
    flags: 0x1 | 0x2 | 0x10,
  };
  try {
    const res = await fetch(
      "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=6.1-preview.1",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const ext = json?.results?.[0]?.extensions?.[0];
    if (!ext) return null;
    const version = ext.versions?.[0]?.version ?? null;
    const stats = {};
    for (const s of ext.statistics ?? []) {
      stats[s.statisticName] = s.value;
    }
    const downloadCount = Math.round(stats.downloadCount ?? stats.install ?? 0);
    return {
      version,
      url: `https://marketplace.visualstudio.com/items?itemName=${VSCE_NS}.${NAME}`,
      downloadCount,
      installCount: downloadCount,
      installQuery: VSCE_EXT_ID,
      published: true,
    };
  } catch {
    return null;
  }
}

async function githubDiscussionsAndIssues() {
  const discussionsRes = await fetch(
    `https://api.github.com/repos/${REPO}/discussions?per_page=10`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  let discussions = [];
  let discussionsEnabled = discussionsRes.ok;
  if (discussionsRes.ok) {
    const data = await discussionsRes.json();
    discussions = Array.isArray(data)
      ? data.map((d) => ({
          title: d.title,
          url: d.html_url,
          category: d.category?.name ?? "General",
          createdAt: d.created_at,
          comments: d.comments ?? 0,
          answered: Boolean(d.answer_chosen_at),
        }))
      : [];
  }

  const issues = await fetchJson(
    `https://api.github.com/repos/${REPO}/issues?state=all&per_page=30&sort=updated`
  );
  const topicMap = new Map();
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (issue.pull_request) continue;
      const labels = (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean);
      const topic = labels[0] ?? "General";
      if (!topicMap.has(topic)) {
        topicMap.set(topic, { topic, count: 0, items: [] });
      }
      const entry = topicMap.get(topic);
      entry.count += 1;
      if (entry.items.length < 5) {
        entry.items.push({
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          comments: issue.comments ?? 0,
          updatedAt: issue.updated_at,
        });
      }
    }
  }

  return {
    enabled: discussionsEnabled,
    discussions,
    topics: [...topicMap.values()].sort((a, b) => b.count - a.count),
    settingsUrl: `https://github.com/${REPO}/settings#features`,
  };
}

const [github, githubTagList, githubDownloads, ovsxCanonical, ovsxDuplicate, vscode, community, visitors] = await Promise.all([
  githubLatestRelease(),
  githubTags(),
  githubReleaseDownloadTotal(),
  ovsxLatest(OVSX_NS),
  ovsxLatest(OVSX_DUPLICATE_NS),
  vsceLatest(),
  githubDiscussionsAndIssues(),
  readVisitorStats(),
]);

const version = github?.version ?? pkg.version;
const vsixName = github?.vsixName ?? `${NAME}-${version}.vsix`;
const syncStatus = computeSyncStatus(ovsxCanonical?.version, ovsxDuplicate?.version, version);
const deployTags = githubTagList.length > 0
  ? githubTagList
  : github?.tag
    ? [github.tag]
    : [`v${pkg.version.replace(/^v/, "")}`];

const ovsx = ovsxCanonical ?? {
  namespace: OVSX_NS,
  version: null,
  url: `https://open-vsx.org/extension/${OVSX_NS}/${NAME}`,
  downloadable: false,
  downloadCount: 0,
  installQuery: OVSX_EXT_ID,
};

const downloadBreakdown = {
  openVsxCanonical: ovsxCanonical?.downloadCount ?? 0,
  openVsxDuplicate: ovsxDuplicate?.downloadCount ?? 0,
  vscodeMarketplace: vscode?.downloadCount ?? 0,
  githubVsix: githubDownloads,
  latestReleaseVsix: github?.vsixDownloadCount ?? 0,
};

const totalDownloads =
  downloadBreakdown.openVsxCanonical +
  downloadBreakdown.vscodeMarketplace +
  downloadBreakdown.githubVsix;

const siteData = {
  generatedAt: new Date().toISOString(),
  displayName: pkg.displayName,
  description: pkg.description,
  version,
  packageVersion: pkg.version,
  syncStatus,
  ovsxPublisher: OVSX_NS,
  vscePublisher: VSCE_NS,
  extensionName: NAME,
  ovsxExtensionId: OVSX_EXT_ID,
  vsceExtensionId: VSCE_EXT_ID,
  homepage: pkg.homepage,
  repository: `https://github.com/${REPO}`,
  author: pkg.author,
  downloads: {
    total: totalDownloads,
    breakdown: downloadBreakdown,
    note: "Total excludes duplicate Open VSX namespace to avoid double-counting.",
  },
  visitors: {
    ...visitors,
    totalEngagement:
      (visitors.websiteVisits ?? 0) +
      Object.values(visitors.packageClicks ?? {}).reduce((s, n) => s + (n ?? 0), 0),
  },
  community: {
    discussionsEnabled: community.enabled,
    discussions: community.discussions,
    topics: community.topics,
    settingsUrl: community.settingsUrl,
    repoIssuesUrl: `https://github.com/${REPO}/issues`,
  },
  analytics: {
    beaconPath: "/api/analytics/visit",
    beaconUrl: "https://cursor-dev.lorapok.tech/api/analytics/visit",
    gaMeasurementId: (() => {
      try {
        const social = JSON.parse(readFileSync(join(root, "website", "social.json"), "utf8"));
        return social?.analytics?.gaMeasurementId || "";
      } catch {
        return "";
      }
    })(),
  },
  ovsx: {
    ...ovsx,
    namespace: OVSX_NS,
    canonical: true,
  },
  ovsxDuplicate: ovsxDuplicate ?? {
    namespace: OVSX_DUPLICATE_NS,
    version: null,
    url: `https://open-vsx.org/extension/${OVSX_DUPLICATE_NS}/${NAME}`,
    downloadable: false,
    downloadCount: 0,
    installQuery: `${OVSX_DUPLICATE_NS}.${NAME}`,
    deprecated: true,
  },
  vscode: vscode ?? {
    version: null,
    url: `https://marketplace.visualstudio.com/items?itemName=${VSCE_NS}.${NAME}`,
    downloadCount: 0,
    installCount: 0,
    installQuery: VSCE_EXT_ID,
    published: false,
  },
  github: {
    repo: REPO,
    releaseTag: github?.tag ?? `v${version}`,
    tags: deployTags,
    releaseUrl: github?.url ?? `https://github.com/${REPO}/releases/latest`,
    vsixName,
    vsixUrl: github?.vsixUrl ?? `https://github.com/${REPO}/releases/latest/download/${vsixName}`,
    vsixDownloadCount: github?.vsixDownloadCount ?? 0,
    totalReleaseDownloads: githubDownloads,
    publishedAt: github?.publishedAt ?? null,
  },
  install: {
    ovsxSearch: OVSX_EXT_ID,
    vsceSearch: VSCE_EXT_ID,
    vsixCommand: `cursor --install-extension ${vsixName}`,
    releasePatch: "./scripts/release.sh patch",
    releaseMinor: "./scripts/release.sh minor",
    releaseTag: `./scripts/release.sh ${version}`,
  },
  notice: DEV_NOTICE,
  stableFallback: buildStableFallbackVersions(deployTags, github?.tag ?? `v${version}`),
};

const out = join(root, "website", "site-data.json");
writeFileSync(out, JSON.stringify(siteData, null, 2) + "\n");
console.log(`Wrote ${out}`);
console.log(`  Version:          ${version}`);
console.log(`  Sync status:      ${syncStatus}`);
console.log(`  Total downloads:  ${totalDownloads.toLocaleString()}`);
console.log(`  Website visits:   ${visitors.websiteVisits ?? 0}`);
console.log(`  Open VSX:         ${ovsxCanonical?.version ?? "n/a"} (${OVSX_NS})`);
console.log(`  Open VSX dup:     ${ovsxDuplicate?.version ?? "n/a"} (${OVSX_DUPLICATE_NS})`);
console.log(`  VS Code:          ${vscode?.version ?? "n/a"}`);
console.log(`  GitHub:           ${github?.tag ?? "n/a"}`);

if (syncStatus !== "synced") {
  console.warn(`::warning::Marketplace sync status is "${syncStatus}" — run scripts/publish-ovsx.mjs to fix Open VSX canonical listing`);
}
