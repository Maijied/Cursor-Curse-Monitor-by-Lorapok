import { fetchSiteDataWithLiveCache } from "../_shared/stats-refresh.js";
import { STATS_README_SVG_KEY } from "../_shared/stats-refresh-config.js";
import { buildReadmeStatsFromSiteData, renderReadmeStatsSvg } from "../_shared/readme-stats.js";

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
};

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const cachedSvg = env.ADMIN_KV?.get ? await env.ADMIN_KV.get(STATS_README_SVG_KEY) : null;
    if (cachedSvg) {
      return new Response(cachedSvg, { status: 200, headers: CACHE_HEADERS });
    }

    const data = await fetchSiteDataWithLiveCache(env);
    const stats = buildReadmeStatsFromSiteData(data);
    const svg = renderReadmeStatsSvg(stats);
    return new Response(svg, { status: 200, headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "stats unavailable";
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="80" viewBox="0 0 720 80">
  <rect width="720" height="80" rx="12" fill="#0b1020" stroke="#7c5cff"/>
  <text x="24" y="48" fill="#f8fafc" font-size="16" font-family="system-ui,sans-serif">Download stats temporarily unavailable</text>
  <text x="24" y="68" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">${message.replace(/[<>&"]/g, "")}</text>
</svg>`;
    return new Response(fallback, { status: 503, headers: CACHE_HEADERS });
  }
}
