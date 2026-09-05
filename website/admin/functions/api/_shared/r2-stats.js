/**
 * STATS_R2 object storage for large stats artifacts (readme SVG + badge JSON).
 * Keys are stable — swap KV puts for R2 when binding is present.
 *
 * Free tier (monthly): 10 GB storage, 1M Class A ops, 10M Class B ops.
 * When R2 is missing, disabled, or a put fails, stats-refresh falls back to ADMIN_KV
 * (same keys as pre-R2). See stats-refresh.js and readme.svg.ts read path.
 */

/** @see https://developers.cloudflare.com/r2/pricing/ */
export const STATS_R2_FREE_TIER = {
  storageGb: 10,
  classAOperationsPerMonth: 1_000_000,
  classBOperationsPerMonth: 10_000_000,
  pricingUrl: "https://developers.cloudflare.com/r2/pricing/",
};

/** KV keys used when STATS_R2 is unavailable (legacy + fallback). */
export const STATS_ARTIFACTS_KV_FALLBACK = "ADMIN_KV";

export const STATS_R2_README_KEY = "stats/readme.svg";
export const STATS_R2_BADGES_KEY = "stats/badges-bundle.json";

/**
 * @param {Record<string, unknown>} env
 */
export function isStatsR2Available(env) {
  return Boolean(env?.STATS_R2?.put);
}

/**
 * @param {unknown} err
 */
export function isR2NotEntitledError(err) {
  const text = err instanceof Error ? err.message : String(err ?? "");
  return /10042|not entitled|enable R2/i.test(text);
}

/**
 * @param {unknown} err
 */
export function isR2QuotaOrLimitError(err) {
  const text = err instanceof Error ? err.message : String(err ?? "");
  return /quota|limit|too many requests|10058/i.test(text);
}

/**
 * @param {Record<string, unknown>} env
 * @returns {"r2" | "kv"}
 */
export function statsArtifactsWriteTarget(env) {
  return isStatsR2Available(env) ? "r2" : "kv";
}

/**
 * @param {Record<string, unknown>} env
 * @returns {Promise<{ configured: boolean; ok: boolean; error?: string }>}
 */
export async function probeStatsR2(env) {
  const bucket = env?.STATS_R2;
  if (!bucket?.put || !bucket?.head) {
    return { configured: false, ok: false, error: "STATS_R2 binding missing" };
  }
  try {
    await bucket.head(STATS_R2_README_KEY);
    return { configured: true, ok: true };
  } catch (err) {
    const code = err && typeof err === "object" ? String(err.code ?? "") : "";
    if (code === "10007" || /not found/i.test(String(err?.message ?? ""))) {
      return { configured: true, ok: true };
    }
    if (isR2NotEntitledError(err)) {
      return {
        configured: false,
        ok: false,
        error: "R2 not enabled on account (enable in Cloudflare dashboard)",
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { configured: true, ok: false, error: message };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 * @param {string} body
 * @param {string} [contentType]
 */
export async function putStatsR2Text(env, key, body, contentType = "text/plain; charset=utf-8") {
  const bucket = env?.STATS_R2;
  if (!bucket?.put) return false;
  try {
    await bucket.put(key, body, {
      httpMetadata: { contentType },
    });
    return true;
  } catch (err) {
    console.error("putStatsR2Text failed", key, err);
    if (isR2NotEntitledError(err) || isR2QuotaOrLimitError(err)) {
      console.warn("STATS_R2 write blocked — stats-refresh will fall back to ADMIN_KV");
    }
    return false;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} key
 */
export async function getStatsR2Text(env, key) {
  const bucket = env?.STATS_R2;
  if (!bucket?.get) return null;
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return await obj.text();
  } catch (err) {
    console.error("getStatsR2Text failed", key, err);
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} svg
 */
export async function writeStatsReadmeSvgR2(env, svg) {
  return putStatsR2Text(env, STATS_R2_README_KEY, svg, "image/svg+xml; charset=utf-8");
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} badgeBundle
 */
export async function writeStatsBadgesR2(env, badgeBundle) {
  return putStatsR2Text(
    env,
    STATS_R2_BADGES_KEY,
    JSON.stringify(badgeBundle),
    "application/json; charset=utf-8"
  );
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readStatsBadgesR2(env) {
  const raw = await getStatsR2Text(env, STATS_R2_BADGES_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ svg: string; badgeBundle: Record<string, unknown> }} artifacts
 * @returns {Promise<boolean>} true when both objects stored in R2
 */
export async function writeStatsArtifactsR2(env, artifacts) {
  if (!isStatsR2Available(env)) return false;
  const [svgOk, badgesOk] = await Promise.all([
    writeStatsReadmeSvgR2(env, artifacts.svg),
    writeStatsBadgesR2(env, artifacts.badgeBundle),
  ]);
  return svgOk && badgesOk;
}
