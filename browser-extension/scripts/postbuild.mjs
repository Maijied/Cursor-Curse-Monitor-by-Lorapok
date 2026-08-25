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
const media = join(root, "..", "media");
cpSync(join(media, "icon.png"), join(dist, "icons", "icon-16.png"));
cpSync(join(media, "icon.png"), join(dist, "icons", "icon-32.png"));
cpSync(join(media, "icon.png"), join(dist, "icons", "icon-48.png"));
cpSync(join(media, "icon.png"), join(dist, "icons", "icon-128.png"));

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
manifest.background = { service_worker: "background/service-worker.js", type: "module" };
manifest.content_scripts = [
  {
    matches: ["https://cursor.com/*", "https://*.cursor.com/*"],
    js: ["content/auth-capture.js"],
    run_at: "document_start",
    all_frames: true,
  },
];

writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("postbuild: manifest.json + popup.html written");
