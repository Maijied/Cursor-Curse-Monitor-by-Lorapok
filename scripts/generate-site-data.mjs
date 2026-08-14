#!/usr/bin/env node
/**
 * Generates website/site-data.json from package.json + live GitHub/Open VSX/VS Code Marketplace APIs.
 * Run locally or in GitHub Pages CI so install commands stay up to date.
 */
import { readFileSync, writeFileSync } from "node:fs";
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

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
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
    publishedAt: data.published_at,
  };
}

async function ovsxLatest(namespace) {
  const data = await fetchJson(`https://open-vsx.org/api/${namespace}/${NAME}`);
  if (!data?.version) return null;
  return {
    namespace,
    version: data.version,
    url: `https://open-vsx.org/extension/${namespace}/${NAME}`,
    downloadable: data.downloadable !== false,
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
    return {
      version,
      url: `https://marketplace.visualstudio.com/items?itemName=${VSCE_NS}.${NAME}`,
      installCount: stats.install ?? 0,
      installQuery: VSCE_EXT_ID,
      published: true,
    };
  } catch {
    return null;
  }
}

const [github, ovsxCanonical, ovsxDuplicate, vscode] = await Promise.all([
  githubLatestRelease(),
  ovsxLatest(OVSX_NS),
  ovsxLatest(OVSX_DUPLICATE_NS),
  vsceLatest(),
]);

const version = github?.version ?? pkg.version;
const vsixName = github?.vsixName ?? `${NAME}-${version}.vsix`;
const syncStatus = computeSyncStatus(ovsxCanonical?.version, ovsxDuplicate?.version, version);

const ovsx = ovsxCanonical ?? {
  namespace: OVSX_NS,
  version: null,
  url: `https://open-vsx.org/extension/${OVSX_NS}/${NAME}`,
  downloadable: false,
  installQuery: OVSX_EXT_ID,
};

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
    installQuery: `${OVSX_DUPLICATE_NS}.${NAME}`,
    deprecated: true,
  },
  vscode: vscode ?? {
    version: null,
    url: `https://marketplace.visualstudio.com/items?itemName=${VSCE_NS}.${NAME}`,
    installCount: 0,
    installQuery: VSCE_EXT_ID,
    published: false,
  },
  github: {
    repo: REPO,
    releaseTag: github?.tag ?? `v${version}`,
    releaseUrl: github?.url ?? `https://github.com/${REPO}/releases/latest`,
    vsixName,
    vsixUrl: github?.vsixUrl ?? `https://github.com/${REPO}/releases/latest/download/${vsixName}`,
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
};

const out = join(root, "website", "site-data.json");
writeFileSync(out, JSON.stringify(siteData, null, 2) + "\n");
console.log(`Wrote ${out}`);
console.log(`  Version:          ${version}`);
console.log(`  Sync status:      ${syncStatus}`);
console.log(`  Open VSX:         ${ovsxCanonical?.version ?? "n/a"} (${OVSX_NS})`);
console.log(`  Open VSX dup:     ${ovsxDuplicate?.version ?? "n/a"} (${OVSX_DUPLICATE_NS})`);
console.log(`  VS Code:          ${vscode?.version ?? "n/a"}`);
console.log(`  GitHub:           ${github?.tag ?? "n/a"}`);

if (syncStatus !== "synced") {
  console.warn(`::warning::Marketplace sync status is "${syncStatus}" — run scripts/publish-ovsx.mjs to fix Open VSX canonical listing`);
}
