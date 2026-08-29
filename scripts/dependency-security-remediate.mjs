#!/usr/bin/env node
/**
 * Apply npm audit fix across configured production workspaces.
 * Used by Dependency Security Bot remediate workflow after triage.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJson } from "./dependency-security-bot.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function runFix(workspaceDir) {
  const cwd = join(root, workspaceDir);
  console.log(`\n→ npm audit fix in ${workspaceDir}`);
  const result = spawnSync("npm", ["audit", "fix", "--omit=dev"], {
    cwd,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.warn(`::warning::npm audit fix exited ${result.status} in ${workspaceDir}`);
  }
}

function main() {
  const configPath = join(root, ".github/dependency-security.config.json");
  const config = loadJson(configPath, "dependency security config");
  let changed = false;

  for (const workspace of config.workspaces ?? []) {
    const lockPath = join(root, workspace.directory, workspace.lockfile ?? "package-lock.json");
    if (!existsSync(lockPath)) continue;
    const before = readFileSync(lockPath, "utf8");
    runFix(workspace.directory);
    const after = readFileSync(lockPath, "utf8");
    if (before !== after) changed = true;
  }

  if (!changed) {
    console.log("No lockfile changes after npm audit fix.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
