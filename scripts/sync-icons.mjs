#!/usr/bin/env node
/** Sync extension icons to website assets. */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webAssets = join(root, "website", "assets");
mkdirSync(webAssets, { recursive: true });

const copies = [
  ["media/icon.png", "website/assets/icon.png"],
  ["media/icon.svg", "website/assets/icon.svg"],
  ["media/logo.svg", "website/assets/logo.svg"],
  ["media/icon.png", "website/admin/public/assets/icon.png"],
  ["media/icon.svg", "website/admin/public/assets/icon.svg"],
  ["media/logo.svg", "website/admin/public/assets/logo.svg"],
  ["media/logo.png", "website/admin/public/assets/logo.png"],
];

for (const [from, to] of copies) {
  copyFileSync(join(root, from), join(root, to));
  console.log(`Copied ${from} → ${to}`);
}
