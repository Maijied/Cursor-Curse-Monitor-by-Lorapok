import { jsonResponse } from "../_shared/auth.js";
import { incrementVisitorStats } from "../_shared/visitor-stats.js";

/**
 * Marketing site visit / package-click beacon.
 * Persists to ADMIN_KV (`stats:visitors`) so stats-refresh + Discord digests stay live.
 * Firestore client writes on the marketing site remain a secondary path.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const channel = typeof body.channel === "string" ? body.channel : "website";
  const stats = await incrementVisitorStats(env, channel);

  return jsonResponse(
    {
      ok: true,
      channel,
      websiteVisits: stats.websiteVisits,
      totalEngagement: stats.totalEngagement,
      updatedAt: stats.updatedAt,
      source: "kv",
    },
    200,
    { "Access-Control-Allow-Origin": "*" }
  );
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
