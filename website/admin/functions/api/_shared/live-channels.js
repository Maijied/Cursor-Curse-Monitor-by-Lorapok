import { GITHUB_REPO } from "./auth.js";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { headers: { Accept: "application/json" }, ...options });
  if (!res.ok) return null;
  return res.json();
}

async function fetchVsceStats(extensionId) {
  const body = {
    filters: [{ criteria: [{ filterType: 7, value: extensionId }], pageSize: 1, pageNumber: 1 }],
    flags: 0x1 | 0x2 | 0x10,
  };
  try {
    const res = await fetch("https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json;api-version=6.1-preview.1",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const ext = json?.results?.[0]?.extensions?.[0];
    if (!ext) return null;
    const stats = {};
    for (const s of ext.statistics ?? []) {
      stats[s.statisticName] = s.value;
    }
    return {
      version: ext.versions?.[0]?.version ?? null,
      downloadCount: Math.round(stats.install ?? stats.downloadCount ?? stats.averagedownloadcount ?? 0),
    };
  } catch {
    return null;
  }
}

function versionFromChromeAsset(assets) {
  if (!Array.isArray(assets)) return null;
  const zip = assets.find((a) => /chrome.*\.zip$/i.test(a?.name ?? ""));
  const match = zip?.name?.match(/chrome-(\d+\.\d+\.\d+)\.zip$/i);
  return match?.[1] ?? null;
}

function maxTagVersion(tags) {
  if (!Array.isArray(tags) || !tags.length) return null;
  const cores = tags
    .map((t) => String(t?.name ?? t).replace(/^v/i, "").split("-")[0])
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  if (!cores.length) return null;
  return cores.sort((a, b) => {
    const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }).at(-1);
}

/**
 * Query every distribution channel and return observed live versions.
 * @param {object} siteData
 * @param {{ githubToken?: string }} [options]
 */
export async function fetchLiveChannels(siteData, options = {}) {
  const name = siteData.extensionName ?? "cursor-curse-monitor-by-lorapok";
  const vsceId = siteData.vsceExtensionId ?? `LorapokLabs.${name}`;
  const packageVersion = String(siteData.packageVersion ?? siteData.version ?? "")
    .replace(/^v/i, "")
    .split("-")[0];

  const githubHeaders = options.githubToken
    ? { Authorization: `Bearer ${options.githubToken}`, Accept: "application/vnd.github+json" }
    : { Accept: "application/json" };

  const [ovsxCanonical, ovsxDuplicate, githubRelease, githubTags, vsceLive, amoData] = await Promise.all([
    fetchJson(`https://open-vsx.org/api/lorapok-labs/${name}`),
    fetchJson(`https://open-vsx.org/api/LorapokLabs/${name}`),
    fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: githubHeaders }),
    fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=30`, { headers: githubHeaders }),
    fetchVsceStats(vsceId),
    fetchJson("https://addons.mozilla.org/api/v5/addons/addon/cursor-curse-monitor/"),
  ]);

  const githubReleaseVersion =
    githubRelease?.tag_name?.replace(/^v/i, "")?.split("-")[0] ??
    siteData.github?.releaseTag?.replace(/^v/i, "")?.split("-")[0] ??
    null;
  const latestGitTag = maxTagVersion(githubTags) ?? githubReleaseVersion;
  const amoVersion =
    amoData?.current_version?.version ??
    siteData.browserExtension?.firefox?.version ??
    siteData.browserExtension?.version ??
    null;
  const chromeVersion =
    versionFromChromeAsset(githubRelease?.assets) ??
    siteData.github?.chromeZipName?.match(/(\d+\.\d+\.\d+)/)?.[1] ??
    null;

  return [
    {
      id: "github-release",
      label: "GitHub Release",
      version: githubReleaseVersion,
    },
    {
      id: "git-tag",
      label: "Latest git tag",
      version: latestGitTag,
    },
    {
      id: "ovsx-canonical",
      label: "Open VSX (lorapok-labs)",
      version: ovsxCanonical?.version ?? siteData.ovsx?.version ?? null,
      downloadCount: ovsxCanonical?.downloadCount ?? siteData.ovsx?.downloadCount ?? 0,
    },
    {
      id: "ovsx-duplicate",
      label: "Open VSX (LorapokLabs)",
      version: ovsxDuplicate?.version ?? siteData.ovsxDuplicate?.version ?? null,
      downloadCount: ovsxDuplicate?.downloadCount ?? siteData.ovsxDuplicate?.downloadCount ?? 0,
      warn: true,
    },
    {
      id: "vscode",
      label: "VS Code Marketplace",
      version: vsceLive?.version ?? siteData.vscode?.version ?? null,
      downloadCount: vsceLive?.downloadCount ?? siteData.vscode?.downloadCount ?? 0,
    },
    {
      id: "firefox-amo",
      label: "Firefox AMO",
      version: amoVersion && amoVersion !== "0.0.0" ? amoVersion : packageVersion,
      published: amoData?.status === "public",
    },
    {
      id: "chrome-zip",
      label: "Chrome zip (GitHub)",
      version: chromeVersion,
    },
    {
      id: "package",
      label: "package.json (repo)",
      version: packageVersion || null,
    },
  ];
}

/** @param {{ githubToken?: string }} [options] */
export async function fetchGitTagNames(options = {}) {
  const headers = options.githubToken
    ? { Authorization: `Bearer ${options.githubToken}`, Accept: "application/vnd.github+json" }
    : { Accept: "application/json" };
  const data = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=100`, {
    headers,
  });
  if (!Array.isArray(data)) return [];
  return data.map((t) => t?.name).filter(Boolean);
}
