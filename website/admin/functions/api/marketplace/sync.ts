import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { fetchSiteData, packageVersionFromSiteData } from "../_shared/site-data.js";

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

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  let siteData;
  try {
    siteData = await fetchSiteData(env);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "site-data unavailable" }, 502);
  }

  const name = siteData.extensionName ?? "cursor-curse-monitor-by-lorapok";
  const target = packageVersionFromSiteData(siteData);
  const vsceId = siteData.vsceExtensionId ?? `LorapokLabs.${name}`;

  const [ovsxCanonical, ovsxDuplicate, githubRelease, vsceLive] = await Promise.all([
    fetchJson(`https://open-vsx.org/api/lorapok-labs/${name}`),
    fetchJson(`https://open-vsx.org/api/LorapokLabs/${name}`),
    fetchJson(`https://api.github.com/repos/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest`),
    fetchVsceStats(vsceId),
  ]);

  const vscodeVersion = vsceLive?.version ?? siteData.vscode?.version ?? null;
  const vscodeDownloads = vsceLive?.downloadCount ?? siteData.vscode?.downloadCount ?? 0;

  const channels = [
    {
      id: "github",
      label: "GitHub Release",
      version: githubRelease?.tag_name?.replace(/^v/, "") ?? siteData.github?.releaseTag?.replace(/^v/, "") ?? null,
      synced: (githubRelease?.tag_name?.replace(/^v/, "") ?? "") === target,
    },
    {
      id: "ovsx-canonical",
      label: "Open VSX (lorapok-labs)",
      version: ovsxCanonical?.version ?? siteData.openVsx?.version ?? null,
      downloadCount: ovsxCanonical?.downloadCount ?? siteData.openVsx?.downloadCount ?? 0,
      synced: (ovsxCanonical?.version ?? siteData.openVsx?.version) === target,
    },
    {
      id: "ovsx-duplicate",
      label: "Open VSX duplicate",
      version: ovsxDuplicate?.version ?? siteData.openVsxDuplicate?.version ?? null,
      downloadCount: ovsxDuplicate?.downloadCount ?? siteData.openVsxDuplicate?.downloadCount ?? 0,
      synced: false,
      warn: true,
    },
    {
      id: "vscode",
      label: "VS Code Marketplace",
      version: vscodeVersion,
      downloadCount: vscodeDownloads,
      synced: vscodeVersion === target,
    },
    {
      id: "package",
      label: "package.json",
      version: target,
      synced: true,
    },
  ];

  const allSynced = channels.filter((c) => !c.warn).every((c) => c.synced);

  return jsonResponse({
    packageVersion: target,
    syncStatus: allSynced ? "synced" : "drift",
    channels,
    checkedAt: new Date().toISOString(),
  });
}
