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
}
