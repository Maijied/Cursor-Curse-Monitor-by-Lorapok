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
const VSCE_NS = "LorapokLabs";
const NAME = pkg.name;
const OVSX_EXT_ID = `${OVSX_NS}.${NAME}`;
const VSCE_EXT_ID = `${VSCE_NS}.${NAME}`;

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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

async function ovsxLatest() {
  const data = await fetchJson(`https://open-vsx.org/api/${OVSX_NS}/${NAME}`);
  if (!data?.version) return null;
  return {
    version: data.version,
    url: `https://open-vsx.org/extension/${OVSX_NS}/${NAME}`,
    downloadable: data.downloadable !== false,
    installQuery: OVSX_EXT_ID,
  };
}

async function vsceLatest() {
  // VS Code Marketplace Gallery API
  const body = {
    filters: [{
      criteria: [
        { filterType: 7, value: `${VSCE_NS}.${NAME}` },
      ],
      pageSize: 1,
      pageNumber: 1,
    }],
    flags: 0x1 | 0x2 | 0x10, // IncludeVersions | IncludeFiles | IncludeStatistics
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

const [github, ovsx, vscode] = await Promise.all([githubLatestRelease(), ovsxLatest(), vsceLatest()]);

const version = github?.version ?? pkg.version;
const vsixName = github?.vsixName ?? `${NAME}-${version}.vsix`;

const siteData = {
  generatedAt: new Date().toISOString(),
  displayName: pkg.displayName,
  description: pkg.description,
  version,
  packageVersion: pkg.version,
  ovsxPublisher: OVSX_NS,
  vscePublisher: VSCE_NS,
  extensionName: NAME,
  ovsxExtensionId: OVSX_EXT_ID,
  vsceExtensionId: VSCE_EXT_ID,
  homepage: pkg.homepage,
  repository: `https://github.com/${REPO}`,
  author: pkg.author,
  ovsx: ovsx ?? {
    version: null,
    url: `https://open-vsx.org/extension/${OVSX_NS}/${NAME}`,
    downloadable: false,
    installQuery: OVSX_EXT_ID,
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
console.log(`  Version:     ${version}`);
console.log(`  Open VSX:    ${ovsx?.version ?? "n/a"}`);
console.log(`  VS Code:     ${vscode?.version ?? "n/a"}`);
console.log(`  GitHub:      ${github?.tag ?? "n/a"}`);
