import { fetchSiteDataWithLiveCache } from "./stats-refresh.js";
import {
  buildReadmeStatsFromSiteData,
  renderShieldsBadge,
  renderShieldsBadgeUnavailable,
} from "./readme-stats.js";

export const BADGE_KINDS = new Set(["total", "openvsx", "openvsx-total", "vscode"]);

const BADGE_KEYS = {
  total: "stats:badge:total",
  openvsx: "stats:badge:openvsx",
  "openvsx-total": "stats:badge:openvsx-total",
  vscode: "stats:badge:vscode",
};

const BADGE_LABELS = {
  total: "downloads",
  openvsx: "Open VSX",
  "openvsx-total": "Open VSX total",
  vscode: "VS Code",
};

export const BADGE_BUNDLE_KEY = "stats:badges-bundle";

export const BADGE_CORS_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

/**
 * @param {string | null | undefined} raw
 * @returns {"total"|"openvsx"|"openvsx-total"|"vscode"}
 */
export function resolveBadgeKind(raw) {
  const kind = String(raw ?? "total").toLowerCase();
  return BADGE_KINDS.has(kind) ? /** @type {"total"|"openvsx"|"openvsx-total"|"vscode"} */ (kind) : "total";
}

/**
 * Shields.io endpoint JSON for README badges (live KV cache + marketplace refresh).
 *
 * @param {Record<string, unknown>} env
 * @param {"total"|"openvsx"|"openvsx-total"|"vscode"} kind
 */
export async function buildBadgePayload(env, kind) {
  if (env.ADMIN_KV?.get) {
    const bundleRaw = await env.ADMIN_KV.get(BADGE_BUNDLE_KEY);
    if (bundleRaw) {
      const bundle = JSON.parse(bundleRaw);
      if (bundle?.[kind]) {
        return { status: 200, body: bundle[kind] };
      }
    }

    const badgeKey = BADGE_KEYS[kind];
    if (badgeKey) {
      const cached = await env.ADMIN_KV.get(badgeKey);
      if (cached) {
        return { status: 200, body: JSON.parse(cached) };
      }
    }
  }

  const data = await fetchSiteDataWithLiveCache(env);
  const stats = buildReadmeStatsFromSiteData(data);
  if (!stats.verified) {
    return {
      status: 503,
      body: renderShieldsBadgeUnavailable(BADGE_LABELS[kind] ?? "downloads"),
    };
  }

  return { status: 200, body: renderShieldsBadge(stats, kind) };
}

/**
 * @param {Record<string, unknown>} env
 * @param {"total"|"openvsx"|"openvsx-total"|"vscode"} kind
 */
export async function buildBadgeResponse(env, kind) {
  try {
    const { status, body } = await buildBadgePayload(env, kind);
    return new Response(JSON.stringify(body), { status, headers: BADGE_CORS_HEADERS });
  } catch {
    return new Response(
      JSON.stringify({ schemaVersion: 1, label: "downloads", message: "unavailable", color: "lightgrey" }),
      { status: 503, headers: BADGE_CORS_HEADERS },
    );
  }
}
