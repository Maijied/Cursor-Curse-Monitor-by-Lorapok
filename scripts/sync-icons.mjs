#!/usr/bin/env node
/** Sync icons: website uses media/icon.*; IDE extension uses media/extension-icon.* */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webAssets = join(root, "website", "assets");
mkdirSync(webAssets, { recursive: true });

function renderPng(svgPath, outPath, size) {
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), svgPath, "-o", outPath], {
    stdio: "inherit",
  });
  console.log(`Rendered ${outPath.replace(`${root}/`, "")} from ${svgPath.replace(`${root}/`, "")}`);
}

const websiteSvg = join(root, "media", "icon.svg");
const extensionSvg = join(root, "media", "extension-icon.svg");

for (const size of [128, 256]) {
  renderPng(
    websiteSvg,
    join(root, "media", size === 128 ? "icon.png" : "icon-256.png"),
    size
  );
  renderPng(
    extensionSvg,
    join(root, "media", size === 128 ? "extension-icon.png" : "extension-icon-256.png"),
    size
  );
}

const copies = [
  ["media/icon.png", "website/assets/icon.png"],
  ["media/icon.svg", "website/assets/icon.svg"],
  ["media/logo.svg", "website/assets/logo.svg"],
];

for (const [from, to] of copies) {
  copyFileSync(join(root, from), join(root, to));
  console.log(`Copied ${from} → ${to}`);
}
