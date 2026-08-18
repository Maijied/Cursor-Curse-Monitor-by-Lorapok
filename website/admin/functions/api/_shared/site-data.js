const DEFAULT_SITE_DATA_URL =
  "https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/site-data.json";

export async function fetchSiteData(env) {
  const url = env.SITE_DATA_URL ?? DEFAULT_SITE_DATA_URL;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`site-data fetch failed (${res.status})`);
  return res.json();
}

export function tagsFromSiteData(data) {
  if (Array.isArray(data?.github?.tags) && data.github.tags.length > 0) {
    return data.github.tags;
  }
  if (data?.github?.releaseTag) return [data.github.releaseTag];
  if (data?.packageVersion) return [`v${String(data.packageVersion).replace(/^v/, "")}`];
  return [];
}

export function packageVersionFromSiteData(data) {
  return String(data?.packageVersion ?? data?.version ?? "").replace(/^v/, "");
}
