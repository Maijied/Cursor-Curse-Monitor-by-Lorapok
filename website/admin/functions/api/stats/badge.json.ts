import { jsonResponse } from "../_shared/auth.js";
import { fetchSiteData } from "../_shared/site-data.js";
import { buildReadmeStatsFromSiteData, renderShieldsBadge } from "../_shared/readme-stats.js";

const CORS_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
};

const KINDS = new Set(["total", "openvsx", "openvsx-total", "vscode"]);

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const kind = String(url.searchParams.get("kind") ?? "total").toLowerCase();
  const safeKind = KINDS.has(kind) ? /** @type {"total"|"openvsx"|"openvsx-total"|"vscode"} */ (kind) : "total";

  try {
    const data = await fetchSiteData(env);
    const stats = buildReadmeStatsFromSiteData(data);
    return jsonResponse(renderShieldsBadge(stats, safeKind), 200, CORS_HEADERS);
  } catch {
    return jsonResponse(
      { schemaVersion: 1, label: "downloads", message: "unavailable", color: "lightgrey" },
      503,
      CORS_HEADERS,
    );
  }
}
