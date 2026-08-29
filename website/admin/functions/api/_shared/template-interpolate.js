/**
 * Build-time placeholder baking and runtime interpolation for notice/mail templates.
 * Embedded JSON stores {{key}} tokens; resolveProductContext() supplies live values.
 */

/** @type {string[]} */
export const PLACEHOLDER_KEYS = [
  "releaseUrl",
  "latestReleaseUrl",
  "firefoxUrl",
  "ovsxUrl",
  "vscodeUrl",
  "feedbackUrl",
  "collaborateUrl",
  "mainLogoUrl",
  "discordAvatarUrl",
  "adminUrl",
  "homepage",
  "website",
  "supportEmail",
  "productEmail",
  "displayName",
  "repo",
  "publishedReleaseVersion",
  "packageVersion",
  "releaseVersion",
  "version",
  "releaseTag",
];

/**
 * @param {string} str
 * @param {Record<string, unknown>} ctx
 */
export function interpolateString(str, ctx) {
  if (typeof str !== "string" || !str.includes("{{")) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = ctx[key];
    return value == null ? "" : String(value);
  });
}

/**
 * @param {unknown} value
 * @param {Record<string, unknown>} ctx
 */
export function interpolateDeep(value, ctx) {
  if (typeof value === "string") return interpolateString(value, ctx);
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, ctx));
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = interpolateDeep(nested, ctx);
    }
    return out;
  }
  return value;
}

/**
 * Replace concrete ctx values with {{key}} placeholders (longest values first).
 * @param {unknown} value
 * @param {Record<string, unknown>} ctx
 */
export function bakePlaceholders(value, ctx) {
  if (typeof value === "string") {
    let out = value;
    const entries = PLACEHOLDER_KEYS.map((key) => [key, ctx[key]])
      .filter(([, v]) => v != null && String(v).length > 0)
      .sort((a, b) => String(b[1]).length - String(a[1]).length);
    for (const [key, val] of entries) {
      out = out.split(String(val)).join(`{{${key}}}`);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => bakePlaceholders(item, ctx));
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = bakePlaceholders(nested, ctx);
    }
    return out;
  }
  return value;
}
