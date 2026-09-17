#!/usr/bin/env node
/**
 * Smoke checks for create-github-release.mjs helpers via subprocess dry paths.
 * Avoids live GitHub calls — validates CLI help + missing-token guard.
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/create-github-release.mjs");

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env, GITHUB_TOKEN: "", GH_TOKEN: "" },
  });
}

let failed = 0;

const help = run(["--help"]);
if (help.status !== 0 || !/Usage:/.test(help.stdout + help.stderr)) {
  console.error("FAIL: --help should exit 0 with Usage");
  failed++;
} else {
  console.log("OK: --help");
}

const missing = run(["--tag", "v9.9.9", "--name", "test"]);
if (missing.status === 0 || !/GITHUB_TOKEN|GH_TOKEN/.test(missing.stderr + missing.stdout)) {
  console.error("FAIL: missing token should error");
  failed++;
} else {
  console.log("OK: missing token guard");
}

if (failed) {
  process.exit(1);
}
console.log("create-github-release smoke: OK");
