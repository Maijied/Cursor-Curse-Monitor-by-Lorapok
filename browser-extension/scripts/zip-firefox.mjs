#!/usr/bin/env node
/**
 * Package dist/ as a Firefox temporary-install zip (manifest.json at archive root).
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolveExtensionVersion } from "./lib-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const manifestPath = join(dist, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error("::error::dist/manifest.json missing — run npm run build in browser-extension first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const version = resolveExtensionVersion(root);
if (manifest.version !== version) {
  console.error(
    `::error::dist/manifest.json version is "${manifest.version}" but expected "${version}" — rebuild after version:sync.`
  );
  process.exit(1);
}

const outDir = join(root, "artifacts", "firefox");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `cursor-curse-monitor-firefox-${version}.zip`);

const stage = mkdtempSync(join(tmpdir(), "ccm-firefox-"));
cpSync(dist, stage, { recursive: true });

execSync(`cd "${stage}" && zip -r "${outFile}" . -x "manifest.chrome.json"`, { stdio: "inherit" });
rmSync(stage, { recursive: true, force: true });

console.log("Firefox zip:", outFile);
console.log("Load in Firefox: about:debugging → This Firefox → Load Temporary Add-on → select this zip or dist/manifest.json");
