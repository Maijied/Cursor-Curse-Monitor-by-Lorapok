#!/usr/bin/env node
/**
 * Generates website/site-data.json from package.json + live GitHub/Open VSX APIs.
 * Run locally or in GitHub Pages CI so install commands stay up to date.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const REPO = pkg.repository?.url?.match(/github\.com\/([^/]+\/[^/.]+)/)?.[1]
  ?? "Maijied/Cursor-Curse-Monitor-by-Lorapok";
const NS = pkg.publisher;
const NAME = pkg.name;
const EXT_ID = `${NS}.${NAME}`;

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return res.json();
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
  const data = await fetchJson(`https://open-vsx.org/api/${NS}/${NAME}`);
  if (!data?.version) return null;
  return {
    version: data.version,
    url: `https://open-vsx.org/extension/${NS}/${NAME}`,
    downloadable: data.downloadable !== false,
    installQuery: EXT_ID,
  };
}

const [github, ovsx] = await Promise.all([githubLatestRelease(), ovsxLatest()]);

const version = github?.version ?? pkg.version;
const vsixName = github?.vsixName ?? `${NAME}-${version}.vsix`;

const siteData = {
  generatedAt: new Date().toISOString(),
  displayName: pkg.displayName,
  description: pkg.description,
  version,
  packageVersion: pkg.version,
  publisher: NS,
  extensionId: EXT_ID,
  extensionName: NAME,
  homepage: pkg.homepage,
  repository: `https://github.com/${REPO}`,
  author: pkg.author,
  ovsx: ovsx ?? {
    version: null,
    url: `https://open-vsx.org/extension/${NS}/${NAME}`,
    downloadable: false,
    installQuery: EXT_ID,
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
    ovsxSearch: EXT_ID,
    vsixCommand: `cursor --install-extension ${vsixName}`,
    releasePatch: "./scripts/release.sh patch",
    releaseMinor: "./scripts/release.sh minor",
    releaseTag: `./scripts/release.sh ${version}`,
  },
};

const out = join(root, "website", "site-data.json");
writeFileSync(out, JSON.stringify(siteData, null, 2) + "\n");
console.log(`Wrote ${out} (v${version}, Open VSX: ${ovsx?.version ?? "n/a"})`);
