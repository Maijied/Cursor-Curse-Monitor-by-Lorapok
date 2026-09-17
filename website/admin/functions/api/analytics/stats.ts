import { jsonResponse } from "../_shared/auth.js";
import { readVisitorStatsMerged } from "../_shared/visitor-stats.js";

/**
 * Public visitor stats for stats-refresh / CI (`ANALYTICS_STATS_URL`).
 * Auth is not required — counters are non-sensitive aggregates.
 * Prefers ADMIN_KV, seeded/merged with public Firestore `stats/visitors`.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const stats = await readVisitorStatsMerged(env);

  return jsonResponse(
    {
      websiteVisits: stats.websiteVisits ?? 0,
      packageClicks: stats.packageClicks ?? {},
      totalEngagement: stats.totalEngagement ?? 0,
      updatedAt: stats.updatedAt ?? null,
      source: stats.source ?? "unknown",
    },
    200,
    {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    }
  );
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
