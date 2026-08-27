import { jsonResponse } from "./_shared/auth.js";
import { fetchSiteData } from "./_shared/site-data.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
};

/**
 * Proxy live marketing site-data.json so Mission Control KPIs match the public site.
 */
export async function onRequestGet(context) {
  try {
    const data = await fetchSiteData(context.env);
    return jsonResponse(data, 200, CORS_HEADERS);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "site-data unavailable" },
      502,
      CORS_HEADERS,
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
