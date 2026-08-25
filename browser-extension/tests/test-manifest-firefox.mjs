#!/usr/bin/env node
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "dist", "manifest.json");

if (!existsSync(manifestPath)) {
  console.error("Run npm run build -w browser-extension first");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert(!manifest.background?.service_worker, "Firefox dist manifest must not include background.service_worker");
assert(Array.isArray(manifest.background?.scripts), "background.scripts required for Firefox");
assert(manifest.background.scripts.includes("background/service-worker.js"), "service worker script path");
assert(manifest.browser_specific_settings?.gecko?.strict_min_version === "142.0", "strict_min_version must be 142.0");

console.log("test_manifest_firefox.mjs: OK");
