/**
 * AMO manifest schema requires `author` to be a string (not package.json object).
 * @param {unknown} author
 */
export function formatAuthorForFirefoxAmo(author) {
  if (typeof author === "string") {
    const trimmed = author.trim();
    return trimmed || "Lorapok Labs";
  }
  if (author && typeof author === "object") {
    const record = /** @type {{ name?: string; email?: string; emails?: string[] }} */ (author);
    const name = String(record.name ?? "").trim();
    const email = String(record.email ?? record.emails?.[0] ?? "").trim();
    if (name && email) return `${name} <${email}>`;
    if (name) return name;
    if (email) return email;
  }
  return "Lorapok Labs";
}

/**
 * Firefox AMO manifest transforms applied during postbuild.
 * @param {Record<string, unknown>} manifest
 */
export function applyFirefoxManifestOverrides(manifest) {
  const out = structuredClone(manifest);
  out.background = {
    scripts: ["background/service-worker.js"],
    type: "module",
  };
  if (out.browser_specific_settings?.gecko) {
    out.browser_specific_settings.gecko.strict_min_version = "142.0";
  }
  out.author = formatAuthorForFirefoxAmo(out.author);
  return out;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertFirefoxManifest(manifest) {
  if (manifest.background?.service_worker) {
    throw new Error("Firefox manifest must not include background.service_worker");
  }
  if (!Array.isArray(manifest.background?.scripts)) {
    throw new Error("background.scripts required for Firefox");
  }
  if (!manifest.background.scripts.includes("background/service-worker.js")) {
    throw new Error("service worker script path missing from background.scripts");
  }
  if (manifest.browser_specific_settings?.gecko?.strict_min_version !== "142.0") {
    throw new Error("strict_min_version must be 142.0");
  }
  if (typeof manifest.author !== "string" || !manifest.author.trim()) {
    throw new Error("author must be a non-empty string for Firefox AMO");
  }
}
