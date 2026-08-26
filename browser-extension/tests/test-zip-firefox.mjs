#!/usr/bin/env node
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distManifest = join(root, "dist", "manifest.json");

if (!existsSync(distManifest)) {
  console.log("test-zip-firefox.mjs: skip (dist not built)");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(distManifest, "utf8"));
assert.match(manifest.version, /^\d+\.\d+\.\d+/, "dist manifest version must be semver");
assert.ok(!manifest.background?.service_worker, "Firefox dist manifest must use background.scripts");
assert.ok(Array.isArray(manifest.background?.scripts), "background.scripts required");

execSync("node scripts/zip-firefox.mjs", { cwd: root, stdio: "pipe" });
const zipListing = execSync(`unzip -Z1 artifacts/firefox/cursor-curse-monitor-firefox-${manifest.version}.zip`, {
  cwd: root,
  encoding: "utf8",
});
assert.ok(zipListing.split("\n").includes("manifest.json"), "firefox zip must include manifest.json at root");
assert.ok(!zipListing.split("\n").some((line) => line.endsWith("/manifest.json") && line.includes("/")), "manifest.json must not be nested");

console.log("test-zip-firefox.mjs: OK");
