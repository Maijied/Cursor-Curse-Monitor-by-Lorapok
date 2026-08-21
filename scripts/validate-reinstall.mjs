#!/usr/bin/env node
/**
 * Post-reinstall sanity checks: parse all package.json files, verify workspaces,
 * and run quick compile/test gates.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGE_JSONS = [
  "package.json",
  "browser-extension/package.json",
  "packages/shared/package.json",
  "website/admin/package.json",
];

let failed = false;

function fail(msg) {
  console.error(`::error::${msg}`);
  failed = true;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

for (const rel of PACKAGE_JSONS) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    fail(`Missing ${rel}`);
    continue;
  }
  try {
    const raw = readFileSync(path, "utf8");
    JSON.parse(raw);
    ok(`${rel} parses`);
  } catch (err) {
    fail(`${rel} invalid JSON: ${err.message}`);
  }
}

if (!existsSync(join(root, "node_modules"))) {
  fail("node_modules missing — run npm ci");
} else {
  ok("root node_modules present");
}

const sharedEntry = join(root, "packages/shared/dist/index.js");
if (!existsSync(sharedEntry)) {
  fail("packages/shared/dist missing — run npm run build -w @lorapok/cursor-monitor-shared");
}

try {
  execSync("npm run build -w @lorapok/cursor-monitor-shared", { cwd: root, stdio: "pipe" });
  ok("shared package builds");
} catch (err) {
  fail("shared package build failed");
}

try {
  execSync("npm run compile", { cwd: root, stdio: "pipe" });
  ok("IDE extension compiles");
} catch {
  fail("IDE extension compile failed");
}

if (failed) {
  console.error("\nReinstall validation failed.");
  process.exit(1);
}

console.log("\nReinstall validation passed.");
