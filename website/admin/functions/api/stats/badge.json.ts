import { jsonResponse } from "../_shared/auth.js";
import { fetchSiteDataWithLiveCache } from "../_shared/stats-refresh.js";
import {
  buildReadmeStatsFromSiteData,
  renderShieldsBadge,
  renderShieldsBadgeUnavailable,
} from "../_shared/readme-stats.js";

const CORS_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
};

const KINDS = new Set(["total", "openvsx", "openvsx-total", "vscode"]);
const BADGE_KEYS = {
  total: "stats:badge:total",
  openvsx: "stats:badge:openvsx",
  "openvsx-total": "stats:badge:openvsx-total",
  vscode: "stats:badge:vscode",
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const kind = String(url.searchParams.get("kind") ?? "total").toLowerCase();
  const safeKind = KINDS.has(kind) ? /** @type {"total"|"openvsx"|"openvsx-total"|"vscode"} */ (kind) : "total";

  try {
    const badgeKey = BADGE_KEYS[safeKind];
    if (env.ADMIN_KV?.get && badgeKey) {
      const cached = await env.ADMIN_KV.get(badgeKey);
      if (cached) {
        return jsonResponse(JSON.parse(cached), 200, CORS_HEADERS);
      }
    }

    const data = await fetchSiteDataWithLiveCache(env);
    const stats = buildReadmeStatsFromSiteData(data);
    if (!stats.verified) {
      const labels = {
        total: "downloads",
        openvsx: "Open VSX",
        "openvsx-total": "Open VSX total",
        vscode: "VS Code",
      };
      return jsonResponse(renderShieldsBadgeUnavailable(labels[safeKind] ?? "downloads"), 503, CORS_HEADERS);
    }
    return jsonResponse(renderShieldsBadge(stats, safeKind), 200, CORS_HEADERS);
  } catch {
    return jsonResponse(
      { schemaVersion: 1, label: "downloads", message: "unavailable", color: "lightgrey" },
      503,
      CORS_HEADERS,
    );
  }
}
