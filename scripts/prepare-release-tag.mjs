#!/usr/bin/env node
/**
 * On push to main: bump package.json to max(live)+patch, commit, tag, and push.
 * No-ops when the recommended tag already exists and package.json matches.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bumpType = process.env.BUMP_TYPE || "patch";
const dryRun = process.argv.includes("--dry-run");

function run(cmd, args, { capture = false } = {}) {
  if (dryRun && !capture) {
    console.log(`[dry-run] ${cmd} ${args.join(" ")}`);
    return "";
  }
  return execFileSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });
}

function tagExists(tag) {
  try {
    execFileSync("git", ["rev-parse", `--verify`, `refs/tags/${tag}`], {
      cwd: root,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function writeOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const current = String(pkg.version).split("-")[0];
const planRaw = run("node", ["scripts/compute-next-release-version.mjs", "--json", `--bump=${bumpType}`], {
  capture: true,
});
const plan = JSON.parse(planRaw);
const recommended = plan.recommendedVersion;
const tag = plan.recommendedTag;

if (!recommended || !tag) {
  console.error("::error::Could not resolve next release version from live channels.");
  process.exit(1);
}

const exists = tagExists(tag);
if (current === recommended && exists) {
  console.log(`::notice::Release ${tag} already prepared — skipping tag workflow`);
  writeOutput("tag", tag);
  writeOutput("prepared", "false");
  writeOutput("skipped", "true");
  process.exit(0);
}

if (!dryRun) {
  run("git", ["config", "user.name", "github-actions[bot]"]);
  run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
}

if (current !== recommended) {
  console.log(`Bumping package.json ${current} → ${recommended}`);
  run("npm", ["version", "--no-git-tag-version", recommended]);
  run("git", ["add", "package.json", "package-lock.json"]);
  run("git", ["commit", "-m", `chore: release v${recommended}`]);
}

if (!exists) {
  console.log(`Creating tag ${tag}`);
  run("git", ["tag", tag]);
}

if (!dryRun) {
  run("git", ["push", "origin", "main"]);
  if (!exists) {
    run("git", ["push", "origin", tag]);
  }
}

console.log(`::notice::Prepared release ${tag} (max live v${plan.maxAllVersion} + ${bumpType})`);
writeOutput("tag", tag);
writeOutput("prepared", "true");
writeOutput("skipped", "false");
