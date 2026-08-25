#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveExtensionVersion } from "./lib-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const version = resolveExtensionVersion(root);

function findHtml(name) {
  const walk = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name);
      if (f.isDirectory()) {
        const found = walk(p);
        if (found) return found;
      } else if (f.name === name) return p;
    }
    return null;
  };
  return walk(dist);
}

function rewriteHtmlPaths(html) {
  return html
    .replace(/src="\.\.\/\.\.\/assets\//g, 'src="./assets/')
    .replace(/href="\.\.\/\.\.\/assets\//g, 'href="./assets/')
    .replace(/src="\/assets\//g, 'src="./assets/')
    .replace(/href="\/assets\//g, 'href="./assets/');
}

mkdirSync(join(dist, "icons"), { recursive: true });
mkdirSync(join(dist, "background"), { recursive: true });
const iconsDir = join(root, "icons");
const iconSrc = join(root, "..", "media", "icon.png");
for (const size of [16, 32, 48, 128]) {
  const named = join(iconsDir, `icon-${size}.png`);
  const dest = join(dist, "icons", `icon-${size}.png`);
  cpSync(existsSync(named) ? named : iconSrc, dest);
}

writeFileSync(
  join(dist, "background", "compat.js"),
  readFileSync(join(root, "src", "background", "compat.js"), "utf8")
);

const popupSrc = findHtml("index.html");
const allHtml = readdirSync(dist, { recursive: true })
  .map((f) => join(dist, String(f)))
  .filter((p) => p.endsWith("index.html"));

for (const p of allHtml) {
  const rel = p.replace(dist, "");
  if (rel.includes("popup")) {
    writeFileSync(join(dist, "popup.html"), rewriteHtmlPaths(readFileSync(p, "utf8")));
  }
  if (rel.includes("options")) {
    writeFileSync(join(dist, "options.html"), rewriteHtmlPaths(readFileSync(p, "utf8")));
  }
}

if (!existsSync(join(dist, "popup.html")) && popupSrc) {
  writeFileSync(join(dist, "popup.html"), rewriteHtmlPaths(readFileSync(popupSrc, "utf8")));
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
manifest.version = version;
manifest.action.default_popup = "popup.html";
manifest.options_ui = { page: "options.html", open_in_tab: true };
// Firefox AMO: use background.scripts only (service_worker is ignored and triggers linter warnings).
manifest.background = {
  scripts: ["background/service-worker.js"],
  type: "module",
};
manifest.content_scripts = [
  {
    matches: ["https://cursor.com/*", "https://*.cursor.com/*"],
    js: ["content/auth-capture.js"],
    run_at: "document_start",
    all_frames: true,
  },
];
if (manifest.browser_specific_settings?.gecko) {
  // background.type needs 112+; data_collection_permissions needs 140+ (142 Android).
  manifest.browser_specific_settings.gecko.strict_min_version = "142.0";
}

writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("postbuild: manifest.json + popup.html written");
