#!/usr/bin/env node
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const outDir = join(root, "artifacts", "chrome");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `cursor-curse-monitor-chrome-${pkg.version}.zip`);

execSync(`cd "${join(root, "dist")}" && zip -r "${outFile}" .`, { stdio: "inherit" });
console.log("Chrome zip:", outFile);
