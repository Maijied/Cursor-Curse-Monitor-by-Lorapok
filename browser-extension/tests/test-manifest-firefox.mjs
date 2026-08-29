#!/usr/bin/env node
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyFirefoxManifestOverrides, assertFirefoxManifest, formatAuthorForFirefoxAmo } from "../scripts/lib-firefox-manifest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const built = applyFirefoxManifestOverrides(source);

assertFirefoxManifest(built);
assert.equal(built.background.type, "module");
assert.equal(
  built.author,
  "Mohammad Maizied Hasan Majumder <mdshuvo40@gmail.com>"
);
assert.equal(
  formatAuthorForFirefoxAmo({ name: "Lorapok Labs", email: "lorapokdev@gmail.com" }),
  "Lorapok Labs <lorapokdev@gmail.com>"
);

const distPath = join(root, "dist", "manifest.json");
if (existsSync(distPath)) {
  assertFirefoxManifest(JSON.parse(readFileSync(distPath, "utf8")));
}

console.log("test_manifest_firefox.mjs: OK");
