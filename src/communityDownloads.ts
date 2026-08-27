import {
  COMMUNITY_DOWNLOADS_SITE_DATA_URL,
  CommunityDownloadStats,
  parseCommunityDownloadsFromSiteData,
} from "@lorapok/cursor-monitor-shared";

const CACHE_MS = 6 * 60 * 60 * 1000;

let cachedStats: CommunityDownloadStats | null = null;
let cachedAt = 0;

export async function fetchCommunityDownloadStats(force = false): Promise<CommunityDownloadStats | null> {
  const now = Date.now();
  if (!force && cachedStats && now - cachedAt < CACHE_MS) {
    return cachedStats;
  }

  try {
    const response = await fetch(COMMUNITY_DOWNLOADS_SITE_DATA_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return cachedStats;
    const data = await response.json();
    cachedStats = parseCommunityDownloadsFromSiteData(data);
    cachedAt = now;
    return cachedStats;
  } catch {
    return cachedStats;
  }
}
