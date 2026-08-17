import { logAuthenticatedRequest } from "../_shared/activity-log.js";
import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { fetchSiteData, packageVersionFromSiteData } from "../_shared/site-data.js";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return res.json();
}

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  let siteData;
  try {
    siteData = await fetchSiteData(env);
  } catch (err) {
    const response = jsonResponse({ error: err instanceof Error ? err.message : "site-data unavailable" }, 502);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const name = siteData.extensionName ?? "cursor-curse-monitor-by-lorapok";
  const target = packageVersionFromSiteData(siteData);

  const [ovsxCanonical, ovsxDuplicate, githubRelease] = await Promise.all([
    fetchJson(`https://open-vsx.org/api/lorapok-labs/${name}`),
    fetchJson(`https://open-vsx.org/api/LorapokLabs/${name}`),
    fetchJson(`https://api.github.com/repos/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest`),
  ]);

  const vscodeVersion = siteData.vscode?.version ?? null;

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
      downloadCount: siteData.vscode?.downloadCount ?? 0,
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

  const response = jsonResponse({
    packageVersion: target,
    syncStatus: allSynced ? "synced" : "drift",
    channels,
    checkedAt: new Date().toISOString(),
  });
  return logAuthenticatedRequest(context, auth, response, startedAt);
}
