import { jsonResponse, verifyAdminRequest } from "../_shared/auth.js";
import { readVisitorStats } from "../_shared/visitor-stats.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

/** Aggregated visitor stats from ADMIN_KV (no PII). */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const adminOnly = url.searchParams.get("admin") === "1";

  if (adminOnly) {
    const auth = await verifyAdminRequest(request, env);
    if (auth.error) return auth.error;
  }

  const stats = await readVisitorStats(env);
  return jsonResponse({ ...stats, source: "admin-kv" }, 200, CORS);
}
