#!/usr/bin/env node
/**
 * Generates website/site-data.json from package.json + live GitHub/Open VSX/VS Code Marketplace APIs.
 * Run locally or in GitHub Pages CI so install commands stay up to date.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { fetchVsceExtension } from "../website/admin/functions/api/_shared/vsce-stats.js";
import { computeDownloadTotals, preserveVerifiedDownloads } from "./download-totals.mjs";
import { buildProductContext } from "./lib-product-context.mjs";
import { buildGeneratedCatalogNotice, buildNoticeTemplates } from "./notice-templates.mjs";
import { buildMailTemplates } from "./mail-templates.mjs";
import { warnLiveChannelDrift } from "../website/admin/functions/api/_shared/version-plan.js";

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

const sharedDist = join(root, "packages", "shared", "dist", "supportedIdeWrappers.js");
if (!existsSync(sharedDist)) {
  execSync("npm run build -w @lorapok/cursor-monitor-shared", { cwd: root, stdio: "inherit" });
}
const {
  SUPPORTED_IDE_WRAPPERS,
  SUPPORTED_IDE_WRAPPERS_HEADLINE,
  SUPPORTED_IDE_WRAPPERS_SUBLINE,
} = await import(`file://${sharedDist}`);

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
  if (compareSemver(canonical, target) < 0) return "drift";
  if (compareSemver(canonical, target) > 0) return "ahead";
  if (duplicate && compareSemver(duplicate, target) < 0) return "drift";
  if (duplicate && compareSemver(duplicate, canonical) !== 0) return "dual-listing";
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

function readRootPackageVersion() {
  try {
    const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return rootPkg.version ?? null;
  } catch {
    return null;
  }
}

function readBrowserExtensionVersion() {
  const rootVersion = readRootPackageVersion();
  try {
    const manifestPath = join(root, "browser-extension", "dist", "manifest.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.version && manifest.version !== "0.0.0") {
        if (rootVersion && normalizeVersion(manifest.version) !== normalizeVersion(rootVersion)) {
          return rootVersion;
        }
        return manifest.version;
      }
    }
    const extPkg = JSON.parse(readFileSync(join(root, "browser-extension", "package.json"), "utf8"));
    if (extPkg.version && extPkg.version !== "0.0.0") return extPkg.version;
    return rootVersion;
  } catch {
    return rootVersion;
  }
}

const AMO_SLUG = "cursor-curse-monitor";
const AMO_PUBLIC_URL = `https://addons.mozilla.org/en-US/firefox/addon/${AMO_SLUG}/`;

async function amoJwtToken() {
  const issuer = process.env.AMO_JWT_ISSUER || process.env.AMO_API_KEY;
  const secret = process.env.AMO_JWT_SECRET || process.env.AMO_API_SECRET;
  if (!issuer || !secret) return null;
  const crypto = await import("node:crypto");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: issuer, jti: `${now}-${Math.random()}`, iat: now, exp: now + 300 })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function fetchFirefoxAmo() {
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${AMO_SLUG}/`;
  const token = await amoJwtToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `JWT ${token}`;

  let data = null;
  try {
    const res = await fetch(url, { headers });
    if (res.ok) data = await res.json();
  } catch {
    // fall through to defaults
  }

  const fallbackVersion = readBrowserExtensionVersion();
  if (!data) {
    return {
      url: AMO_PUBLIC_URL,
      published: false,
      reviewStatus: "unknown",
      version: fallbackVersion,
    };
  }

  const fileStatus = data.current_version?.file?.status ?? data.current_version?.status ?? null;
  const addonStatus = data.status ?? null;
  const published = addonStatus === "public" && fileStatus === "public";
  const reviewStatus =
    fileStatus === "public"
      ? "public"
      : fileStatus === "awaiting-review" || fileStatus === "nominated" || fileStatus === "unreviewed"
        ? "awaiting-review"
        : fileStatus || addonStatus || "unknown";

  return {
    url: data.url || AMO_PUBLIC_URL,
    published,
    reviewStatus,
    version: data.current_version?.version ?? fallbackVersion,
    averageDailyUsers: data.average_daily_users ?? undefined,
  };
}

async function githubTags() {
  const data = await fetchJson(`https://api.github.com/repos/${REPO}/tags?per_page=100`);
  if (!Array.isArray(data)) return [];
  return data.map((t) => t.name).filter(Boolean);
}

async function githubLatestRelease() {
  const data = await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!data?.tag_name) return null;
  const tag = data.tag_name.replace(/^v/, "");
  const vsix = (data.assets ?? []).find((a) => a.name?.endsWith(".vsix"));
  const chromeZip = (data.assets ?? []).find((a) => /chrome.*\.zip$/i.test(a.name ?? ""));
  const firefoxXpi = (data.assets ?? []).find((a) => a.name?.endsWith(".xpi"));
  return {
    tag: data.tag_name,
    version: tag,
    url: data.html_url,
    vsixName: vsix?.name ?? `${NAME}-${tag}.vsix`,
    vsixUrl: vsix?.browser_download_url ?? null,
    vsixDownloadCount: vsix?.download_count ?? 0,
    chromeZipUrl: chromeZip?.browser_download_url ?? null,
    chromeZipName: chromeZip?.name ?? null,
    firefoxXpiUrl: firefoxXpi?.browser_download_url ?? null,
    firefoxXpiName: firefoxXpi?.name ?? null,
    publishedAt: data.published_at,
  };
}

async function githubReleaseDownloadTotal() {
  const releases = await fetchJson(`https://api.github.com/repos/${REPO}/releases?per_page=100`);
  if (!Array.isArray(releases)) return null;
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
  const live = await fetchVsceExtension(VSCE_EXT_ID);
  if (!live) return null;
  return {
    version: live.version,
    url: `https://marketplace.visualstudio.com/items?itemName=${VSCE_EXT_ID}`,
    downloadCount: live.downloadCount,
    installCount: live.installCount,
    updateCount: live.updateCount,
    installQuery: VSCE_EXT_ID,
    published: true,
  };
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

const [github, githubTagList, githubDownloads, ovsxCanonical, ovsxDuplicate, vscode, community, visitors, firefoxAmo] = await Promise.all([
  githubLatestRelease(),
  githubTags(),
  githubReleaseDownloadTotal(),
  ovsxLatest(OVSX_NS),
  ovsxLatest(OVSX_DUPLICATE_NS),
  vsceLatest(),
  githubDiscussionsAndIssues(),
  Promise.resolve(fetchRemoteVisitorStats()),
  fetchFirefoxAmo(),
]);

// Root package.json is the release candidate when synced; in git it stays 0.0.0.
// Live channels are observations — warn on drift but never block CI.
const version = pkg.version === "0.0.0" ? (github?.version ?? ovsxCanonical?.version ?? vscode?.version ?? pkg.version) : pkg.version;
const publishedReleaseVersion = github?.version ?? null;

function ovsxUnityVersion(canonicalVersion, duplicateVersion) {
  const canonical = normalizeVersion(canonicalVersion);
  const duplicate = normalizeVersion(duplicateVersion);
  if (!canonical && !duplicate) return null;
  if (!canonical) return duplicate;
  if (!duplicate) return canonical;
  if (canonical === duplicate) return canonical;
  const newer = compareSemver(duplicate, canonical) > 0 ? duplicate : canonical;
  console.warn(
    `::warning::Open VSX namespaces disagree (${canonical} lorapok-labs vs ${duplicate} LorapokLabs). ` +
      `Using ${newer} for release guard until canonical indexing catches up — run sync-open-vsx if drift persists.`
  );
  return newer;
}

const ovsxLive = ovsxUnityVersion(ovsxCanonical?.version, ovsxDuplicate?.version);
warnLiveChannelDrift({
  packageVersion: version,
  channels: [
    { id: "github", label: "GitHub", version: publishedReleaseVersion },
    { id: "ovsx", label: "Open VSX", version: ovsxLive },
    { id: "vscode", label: "VS Code", version: vscode?.version },
  ],
});

const releaseStatus = publishedReleaseVersion === version ? "published" : "candidate";
const vsixName = github?.vsixName ?? `${NAME}-${version}.vsix`;
let syncStatus = computeSyncStatus(ovsxCanonical?.version, ovsxDuplicate?.version, version);
if (releaseStatus !== "published" && syncStatus === "synced") {
  syncStatus = "release-candidate";
}
const deployTags = githubTagList.length > 0
  ? githubTagList
  : github?.tag
    ? [github.tag]
    : [`v${version.replace(/^v/, "")}`];

const ovsx = ovsxCanonical ?? {
  namespace: OVSX_NS,
  version: null,
  url: `https://open-vsx.org/extension/${OVSX_NS}/${NAME}`,
  downloadable: false,
  downloadCount: 0,
  installQuery: OVSX_EXT_ID,
};

const githubAllAssets = githubDownloads;

const downloadTotalsRaw = computeDownloadTotals({
  openVsxCanonical: ovsxCanonical,
  openVsxDuplicate: ovsxDuplicate,
  vscode,
  githubAllAssets,
  packageVersion: version,
});

const existingSiteDataPath = join(root, "website", "site-data.json");
const existingSiteData = existsSync(existingSiteDataPath)
  ? JSON.parse(readFileSync(existingSiteDataPath, "utf8"))
  : null;
const downloadTotals = preserveVerifiedDownloads(existingSiteData?.downloads, downloadTotalsRaw);
if (downloadTotals.verified && !downloadTotalsRaw.verified) {
  console.warn(
    "::warning::Live download sources incomplete — preserving last verified download totals",
  );
}

const downloadBreakdown = {
  ...downloadTotals.breakdown,
  latestReleaseVsix: github?.vsixDownloadCount ?? 0,
};

const productContext = buildProductContext(pkg, { publishedReleaseVersion });
const noticeTemplates = buildNoticeTemplates(productContext);
const mailTemplates = buildMailTemplates(productContext);
const defaultNotice = buildGeneratedCatalogNotice(productContext);

const siteData = {
  generatedAt: new Date().toISOString(),
  displayName: pkg.displayName,
  description: pkg.description,
  version,
  packageVersion: version,
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
  company: pkg.company ?? null,
  productContext,
  notice: defaultNotice,
  noticeTemplates: noticeTemplates.map(({ templateId, label, category, severity, type }) => ({
    templateId,
    label,
    category,
    severity,
    type,
  })),
  mailTemplates: mailTemplates.map(({ id, label, category, subject }) => ({
    id,
    label,
    category,
    subject,
  })),
  downloads: {
    total: downloadTotals.displayTotal,
    displayTotal: downloadTotals.displayTotal,
    verified: downloadTotals.verified,
    liveSources: downloadTotals.liveSources,
    canonicalTotal: downloadTotals.canonicalTotal,
    source: downloadTotals.source,
    breakdown: downloadBreakdown,
    openVsxCombined: downloadTotals.openVsxCombined,
    note: "Grand total sums all live marketplace channels (Open VSX canonical + LorapokLabs duplicate + VS Code downloadCount + GitHub release assets).",
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
  ovsxDuplicate: ovsxDuplicate,
  vscode,
  github: {
    repo: REPO,
    releaseTag: github?.tag ?? `v${version}`,
    tags: deployTags,
    releaseUrl: github?.url ?? `https://github.com/${REPO}/releases/latest`,
    vsixName,
    vsixUrl:
      github?.vsixUrl
      ?? `https://github.com/${REPO}/releases/download/${github?.tag ?? `v${version}`}/${vsixName}`,
    vsixDownloadCount: github?.vsixDownloadCount ?? 0,
    totalReleaseDownloads: githubDownloads,
    publishedAt: github?.publishedAt ?? null,
    chromeZipUrl: github?.chromeZipUrl ?? null,
    chromeZipName: github?.chromeZipName ?? null,
    firefoxXpiUrl: github?.firefoxXpiUrl ?? null,
    firefoxXpiName: github?.firefoxXpiName ?? null,
  },
  browserExtension: {
    version,
    firefox: {
      ...firefoxAmo,
      version:
        firefoxAmo.version && firefoxAmo.version !== "0.0.0"
          ? firefoxAmo.version
          : version,
      xpiUrl: github?.firefoxXpiUrl ?? null,
      xpiName: github?.firefoxXpiName ?? null,
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
  supportedIdes: {
    headline: SUPPORTED_IDE_WRAPPERS_HEADLINE,
    subline: SUPPORTED_IDE_WRAPPERS_SUBLINE,
    ides: SUPPORTED_IDE_WRAPPERS,
  },
};

const out = join(root, "website", "site-data.json");
writeFileSync(out, JSON.stringify(siteData, null, 2) + "\n");
const visitorOut = join(root, "website", "visitor-stats.json");
writeFileSync(visitorOut, JSON.stringify(siteData.visitors, null, 2) + "\n");
execSync("node scripts/generate-readme-stats.mjs", { cwd: root, stdio: "inherit" });
console.log(`Wrote ${out}`);
console.log(`Wrote ${visitorOut}`);
console.log(`  Version:          ${version}`);
console.log(`  Sync status:      ${syncStatus}`);
console.log(`  Total downloads:  ${downloadTotals.verified ? downloadTotals.displayTotal.toLocaleString() : "unverified (missing live sources)"}`);
console.log(`  Website visits:   ${visitors.websiteVisits ?? 0}`);
console.log(`  Open VSX:         ${ovsxCanonical?.version ?? "n/a"} (${OVSX_NS})`);
console.log(`  Open VSX dup:     ${ovsxDuplicate?.version ?? "n/a"} (${OVSX_DUPLICATE_NS})`);
console.log(`  VS Code:          ${vscode?.version ?? "n/a"}`);
console.log(`  GitHub:           ${github?.tag ?? "n/a"}`);

if (syncStatus !== "synced") {
  console.warn(
    `::warning::Marketplace sync status is "${syncStatus}" — run Sync Open VSX workflow (publishes both lorapok-labs and LorapokLabs listings)`
  );
}
