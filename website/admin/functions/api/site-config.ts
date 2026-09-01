import { jsonResponse } from "./_shared/auth.js";
import { buildPublicSiteConfig } from "./_shared/subscribe-config.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Public read-only subscribe + mail availability (no secrets). */
export async function onRequestGet(context) {
  const { env } = context;
  const config = await buildPublicSiteConfig(env);
  return jsonResponse(
    {
      ok: true,
      ...config,
      checkedAt: new Date().toISOString(),
    },
    200,
    CORS_HEADERS
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
