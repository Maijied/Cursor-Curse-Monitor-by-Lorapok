import { verifyAdminRequest, jsonResponse } from "../_shared/auth.js";
import { fetchSiteData, packageVersionFromSiteData } from "../_shared/site-data.js";
import { buildVersionPlan } from "../_shared/version-plan.js";

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
    return { version: ext.versions?.[0]?.version ?? null };
  } catch {
    return null;
  }
}

async function fetchAmoVersion() {
  const data = await fetchJson("https://addons.mozilla.org/api/v5/addons/addon/cursor-curse-monitor/");
  return data?.current_version?.version ?? null;
}

async function fetchLiveChannels(siteData) {
  const name = siteData.extensionName ?? "cursor-curse-monitor-by-lorapok";
  const vsceId = siteData.vsceExtensionId ?? `LorapokLabs.${name}`;

  const [ovsxCanonical, ovsxDuplicate, githubRelease, vsceLive, amoVersion] = await Promise.all([
    fetchJson(`https://open-vsx.org/api/lorapok-labs/${name}`),
    fetchJson(`https://open-vsx.org/api/LorapokLabs/${name}`),
    fetchJson("https://api.github.com/repos/Maijied/Cursor-Curse-Monitor-by-Lorapok/releases/latest"),
    fetchVsceStats(vsceId),
    fetchAmoVersion(),
  ]);

  return [
    {
      id: "github",
      label: "GitHub Release",
      version: githubRelease?.tag_name?.replace(/^v/, "") ?? siteData.github?.releaseTag?.replace(/^v/, "") ?? null,
    },
    {
      id: "ovsx-canonical",
      label: "Open VSX (lorapok-labs)",
      version: ovsxCanonical?.version ?? siteData.ovsx?.version ?? null,
    },
    {
      id: "ovsx-duplicate",
      label: "Open VSX (LorapokLabs)",
      version: ovsxDuplicate?.version ?? siteData.ovsxDuplicate?.version ?? null,
      warn: true,
    },
    {
      id: "vscode",
      label: "VS Code Marketplace",
      version: vsceLive?.version ?? siteData.vscode?.version ?? null,
    },
    {
      id: "firefox-amo",
      label: "Firefox AMO",
      version: amoVersion ?? siteData.browserExtension?.firefox?.version ?? null,
    },
    {
      id: "package",
      label: "package.json (repo truth)",
      version: packageVersionFromSiteData(siteData),
    },
  ];
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const bumpType = url.searchParams.get("bump") ?? "patch";
  if (!["patch", "minor", "major"].includes(bumpType)) {
    return jsonResponse({ error: "bump must be patch, minor, or major" }, 400);
  }

  let siteData;
  try {
    siteData = await fetchSiteData(env);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "site-data unavailable" }, 502);
  }

  const channels = await fetchLiveChannels(siteData);
  const plan = buildVersionPlan({
    packageVersion: packageVersionFromSiteData(siteData),
    channels,
    bumpType,
  });

  return jsonResponse({
    checkedAt: new Date().toISOString(),
    bumpType,
    channels,
    ...plan,
  });
}
