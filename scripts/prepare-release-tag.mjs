#!/usr/bin/env node
/**
 * On push to main: create the next git tag from max(live marketplaces) + patch.
 * Package.json stays at 0.0.0 in git — versions are synced at CI build/deploy time.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCiVersion } from "./resolve-ci-version.mjs";

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

function runCapture(cmd, args) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd} ${args.join(" ")}`);
    return { ok: true, output: "" };
  }
  try {
    const output = execFileSync(cmd, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
    });
    return { ok: true, output: output ?? "" };
  } catch (error) {
    const output = [error?.stdout, error?.stderr, error?.message].filter(Boolean).join("\n");
    return { ok: false, output };
  }
}

function tagExists(tag) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/tags/${tag}`], {
      cwd: root,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function remoteTagExists(tag) {
  const result = runCapture("git", ["ls-remote", "--tags", "origin", tag]);
  return result.ok && result.output.includes(tag);
}

function writeOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function pushTag(tag) {
  const result = runCapture("git", ["push", "origin", tag]);
  if (result.ok) return;
  if (/already exists|rejected|denied/i.test(result.output)) {
    console.log(`::warning::Tag ${tag} push skipped — ${result.output.trim()}`);
    return;
  }
  console.error(`::error::Failed to push tag ${tag}\n${result.output}`);
  process.exit(1);
}

const plan = await resolveCiVersion({ bump: bumpType });
const recommended = plan.recommendedVersion;
const tag = plan.recommendedTag;

if (!recommended || !tag) {
  console.error("::error::Could not resolve next release version from live channels.");
  process.exit(1);
}

if (tagExists(tag) || remoteTagExists(tag)) {
  console.log(`::notice::Release ${tag} already exists — skipping tag workflow`);
  writeOutput("tag", tag);
  writeOutput("prepared", "false");
  writeOutput("skipped", "true");
  writeOutput("pr_required", "false");
  process.exit(0);
}

if (!dryRun) {
  run("git", ["config", "user.name", "github-actions[bot]"]);
  run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
}

console.log(`Creating tag ${tag} (max live v${plan.maxAllVersion} + ${bumpType})`);
if (!tagExists(tag)) {
  run("git", ["tag", tag]);
}

if (!dryRun) {
  pushTag(tag);
}

console.log(`::notice::Prepared release tag ${tag} (max live v${plan.maxAllVersion} + ${bumpType})`);
writeOutput("tag", tag);
writeOutput("prepared", "true");
writeOutput("skipped", "false");
writeOutput("pr_required", "false");
