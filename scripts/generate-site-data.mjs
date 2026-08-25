#!/usr/bin/env node
/**
 * Generates website/site-data.json from package.json + live GitHub/Open VSX/VS Code Marketplace APIs.
 * Run locally or in GitHub Pages CI so install commands stay up to date.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeDownloadTotals } from "./download-totals.mjs";

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

function readVisitorStats() {
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

function parseFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("mapValue" in value) {
    const out = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      out[k] = parseFirestoreValue(v);
    }
    return out;
  }
  return null;
}

async function fetchFirestoreVisitorStats() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "cursor-curse-by-lorapok";
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stats/visitors`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const doc = await res.json();
    const fields = doc.fields ?? {};
    const websiteVisits = parseFirestoreValue(fields.websiteVisits) ?? 0;
    const packageClicks = parseFirestoreValue(fields.packageClicks) ?? {};
    const updatedAt = parseFirestoreValue(fields.updatedAt) ?? new Date().toISOString();
    const clicks = {
      ovsx: Number(packageClicks.ovsx ?? 0),
      vscode: Number(packageClicks.vscode ?? 0),
      github: Number(packageClicks.github ?? 0),
      vsix: Number(packageClicks.vsix ?? 0),
      openvsxDuplicate: Number(packageClicks.openvsxDuplicate ?? 0),
    };
    const totalEngagement =
      websiteVisits + Object.values(clicks).reduce((s, n) => s + (n ?? 0), 0);
    return { websiteVisits, packageClicks: clicks, totalEngagement, updatedAt, source: "firestore" };
  } catch {
    return null;
  }
}

async function fetchRemoteVisitorStats() {
  const remoteUrl = process.env.ANALYTICS_STATS_URL?.trim();
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        return { ...data, source: "remote" };
      }
    } catch {
      /* fall through */
    }
  }
  const firestore = await fetchFirestoreVisitorStats();
  if (firestore) return firestore;
  return readVisitorStats();
}

function readBrowserExtensionVersion() {
  try {
    const extPkg = JSON.parse(readFileSync(join(root, "browser-extension", "package.json"), "utf8"));
    return extPkg.version ?? null;
  } catch {
    return null;
  }
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
  const chromeZip = (data.assets ?? []).find((a) => /chrome.*\.zip$/i.test(a.name ?? ""));
  return {
    tag: data.tag_name,
    version: tag,
    url: data.html_url,
    vsixName: vsix?.name ?? `${NAME}-${tag}.vsix`,
    vsixUrl: vsix?.browser_download_url ?? null,
    vsixDownloadCount: vsix?.download_count ?? 0,
    chromeZipUrl: chromeZip?.browser_download_url ?? null,
    chromeZipName: chromeZip?.name ?? null,
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
    const downloadCount = Math.round(
      stats.install ??
        stats.downloadCount ??
        stats.averagedownloadcount ??
        stats.trendingdaily?.downloadCount ??
        0
    );
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
  let discussions = [];
  let discussionsEnabled = false;
  try {
    const data = await fetchJson(
      `https://api.github.com/repos/${REPO}/discussions?per_page=10`
    );
    if (Array.isArray(data)) {
      discussionsEnabled = true;
      discussions = data.map((d) => ({
        title: d.title,
        url: d.html_url,
        category: d.category?.name ?? "General",
        createdAt: d.created_at,
        comments: d.comments ?? 0,
        answered: Boolean(d.answer_chosen_at),
      }));
    }
  } catch {
    /* fallback when offline or rate limited */
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
  Promise.resolve(fetchRemoteVisitorStats()),
]);

// The repository package is the release candidate. Live marketplace/release
// versions are observations and must never silently replace repository truth.
const version = pkg.version;
const publishedReleaseVersion = github?.version ?? null;
const releaseStatus = publishedReleaseVersion === version ? "published" : "candidate";
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

const githubAllAssets = githubDownloads;

const downloadTotals = computeDownloadTotals({
  openVsxCanonical: ovsxCanonical,
  openVsxDuplicate: ovsxDuplicate,
  vscode,
  githubAllAssets,
  packageVersion: version,
});

const downloadBreakdown = {
  ...downloadTotals.breakdown,
  latestReleaseVsix: github?.vsixDownloadCount ?? 0,
};

const siteData = {
  generatedAt: new Date().toISOString(),
  displayName: pkg.displayName,
  description: pkg.description,
  version,
  packageVersion: pkg.version,
  publishedReleaseVersion,
  releaseStatus,
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
    total: downloadTotals.displayTotal,
    displayTotal: downloadTotals.displayTotal,
    canonicalTotal: downloadTotals.canonicalTotal,
    source: downloadTotals.source,
    breakdown: downloadBreakdown,
    openVsxCombined:
      (downloadBreakdown.openVsxCanonical ?? 0) + (downloadBreakdown.openVsxDuplicate ?? 0),
    note: "Public total uses canonical Open VSX unless canonical lags package version; duplicate namespace excluded from sum.",
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
    chromeZipUrl: github?.chromeZipUrl ?? null,
    chromeZipName: github?.chromeZipName ?? null,
  },
  browserExtension: {
    version: readBrowserExtensionVersion() ?? version,
    firefox: {
      url: "https://addons.mozilla.org/en-US/firefox/addon/cursor-curse-monitor-by-lorapok/",
      published: true,
    },
    chrome: {
      zipUrl: github?.chromeZipUrl ?? null,
      zipName: github?.chromeZipName ?? null,
      webStorePublished: false,
    },
  },
  install: {
    ovsxSearch: OVSX_EXT_ID,
    vsceSearch: VSCE_EXT_ID,
    vsixCommand: `cursor --install-extension ${vsixName}`,
    releasePatch: "./scripts/release.sh patch",
    releaseMinor: "./scripts/release.sh minor",
    releaseTag: `./scripts/release.sh ${pkg.version}`,
  },
};

const out = join(root, "website", "site-data.json");
writeFileSync(out, JSON.stringify(siteData, null, 2) + "\n");
const visitorOut = join(root, "website", "visitor-stats.json");
writeFileSync(visitorOut, JSON.stringify(siteData.visitors, null, 2) + "\n");
console.log(`Wrote ${out}`);
console.log(`Wrote ${visitorOut}`);
console.log(`  Version:          ${version}`);
console.log(`  Sync status:      ${syncStatus}`);
console.log(`  Total downloads:  ${downloadTotals.displayTotal.toLocaleString()}`);
console.log(`  Website visits:   ${visitors.websiteVisits ?? 0}`);
console.log(`  Open VSX:         ${ovsxCanonical?.version ?? "n/a"} (${OVSX_NS})`);
console.log(`  Open VSX dup:     ${ovsxDuplicate?.version ?? "n/a"} (${OVSX_DUPLICATE_NS})`);
console.log(`  VS Code:          ${vscode?.version ?? "n/a"}`);
console.log(`  GitHub:           ${github?.tag ?? "n/a"}`);

if (syncStatus !== "synced") {
  console.warn(`::warning::Marketplace sync status is "${syncStatus}" — run scripts/publish-ovsx.mjs to fix Open VSX canonical listing`);
}
