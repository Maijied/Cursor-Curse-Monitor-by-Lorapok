#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dist = join(root, "dist");
const outDir = join(root, "artifacts", "chrome");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `cursor-curse-monitor-chrome-${pkg.version}.zip`);

const chromeManifestPath = join(dist, "manifest.chrome.json");
const chromeManifest = readFileSync(
  existsSync(chromeManifestPath) ? chromeManifestPath : join(dist, "manifest.json"),
  "utf8"
);

const stage = mkdtempSync(join(tmpdir(), "ccm-chrome-"));
cpSync(dist, stage, { recursive: true });
writeFileSync(join(stage, "manifest.json"), chromeManifest);

execSync(`cd "${stage}" && zip -r "${outFile}" .`, { stdio: "inherit" });
rmSync(stage, { recursive: true, force: true });
console.log("Chrome zip:", outFile);
