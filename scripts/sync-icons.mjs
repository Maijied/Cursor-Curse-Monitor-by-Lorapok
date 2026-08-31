#!/usr/bin/env node
/** Sync icons: marketing PNGs derive from media/logo.svg; IDE uses media/extension-icon.svg */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webAssets = join(root, "website", "assets");
const adminAssets = join(root, "website", "admin", "public", "assets");
mkdirSync(webAssets, { recursive: true });
mkdirSync(adminAssets, { recursive: true });

function renderPng(svgPath, outPath, size) {
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), svgPath, "-o", outPath], {
    stdio: "inherit",
  });
  console.log(`Rendered ${outPath.replace(`${root}/`, "")} from ${svgPath.replace(`${root}/`, "")}`);
}

const websiteSvg = join(root, "media", "logo.svg");
const extensionSvg = join(root, "media", "extension-icon.svg");

let rsvgAvailable = true;
try {
  execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
} catch {
  rsvgAvailable = false;
  console.warn("rsvg-convert not found — skipping PNG re-render; copying existing PNG/SVG files only");
}

if (rsvgAvailable) {
  for (const size of [128, 256, 512, 1024]) {
    renderPng(websiteSvg, join(root, "media", size === 128 ? "icon.png" : size === 256 ? "icon-256.png" : size === 512 ? "logo-512.png" : "logo.png"), size);
  }
  for (const size of [128, 256]) {
    renderPng(
      extensionSvg,
      join(root, "media", size === 128 ? "extension-icon.png" : "extension-icon-256.png"),
      size
    );
  }
}

const copies = [
  ["media/icon.png", "website/assets/icon.png"],
  ["media/logo.png", "website/assets/logo.png"],
  ["media/logo.svg", "website/assets/logo.svg"],
  ["media/logo.svg", "website/assets/icon.svg"],
  ["media/logo.svg", "website/admin/public/assets/logo.svg"],
  ["media/logo.svg", "website/admin/public/assets/icon.svg"],
  ["media/logo.png", "website/admin/public/assets/logo.png"],
  ["media/icon.png", "website/admin/public/assets/icon.png"],
];

for (const [from, to] of copies) {
  const source = join(root, from);
  if (!existsSync(source)) {
    console.warn(`Skip missing ${from}`);
    continue;
  }
  copyFileSync(source, join(root, to));
  console.log(`Copied ${from} → ${to}`);
}
