/**
 * STATS_R2 object storage for large stats artifacts (readme SVG + badge JSON).
 * Keys are stable — swap KV puts for R2 when binding is present.
 */

export const STATS_R2_README_KEY = "stats/readme.svg";
export const STATS_R2_BADGES_KEY = "stats/badges-bundle.json";

/**
 * @param {Record<string, unknown>} env
 */
export function isStatsR2Available(env) {
  return Boolean(env?.STATS_R2?.put);
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
