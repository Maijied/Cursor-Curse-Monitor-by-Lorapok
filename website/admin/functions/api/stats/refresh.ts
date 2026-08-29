import { jsonResponse, verifyAdminRequest } from "../../_shared/auth.js";
import { runStatsRefresh } from "../../_shared/stats-refresh.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const result = await runStatsRefresh(env, { triggeredBy: auth.email ?? "admin", force: true });
    if (result.skipped) {
      return jsonResponse({ ok: false, ...result }, 409, CORS_HEADERS);
    }
    return jsonResponse(
      {
        ok: true,
        durationMs: result.durationMs,
        refreshedAt: result.snapshot?.refreshedAt,
        displayTotal: result.snapshot?.downloads?.displayTotal ?? null,
        syncStatus: result.snapshot?.marketplaceSync?.syncStatus ?? null,
      },
      200,
      CORS_HEADERS
    );
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : "Refresh failed" },
      502,
      CORS_HEADERS
    );
  }
}
