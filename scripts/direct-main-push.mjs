#!/usr/bin/env node
/**
 * Direct main push — push to main + auto procedure, GitHub issue, tracking PR, board sync.
 *
 * Use when bypassing PR review for hotfixes / fast deploy (website, admin).
 *
 *   node scripts/direct-main-push.mjs --title "fix(website): hero universe" --component website
 *   node scripts/direct-main-push.mjs --title "..." --deploy-website
 *   npm run push:main -- --title "..." --component website
 *
 * Requires: gh auth, clean or committed working tree, on branch main.
 */
import { spawnSync } from "node:child_process";
import { loadProcedureConfig } from "./lib/procedure-config.mjs";

function parseArgs(argv) {
  const out = {
    title: "",
    component: "",
    deployWebsite: false,
    deployAdmin: false,
    skipPush: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--skip-push") out.skipPush = true;
    else if (arg === "--deploy-website") out.deployWebsite = true;
    else if (arg === "--deploy-admin") out.deployAdmin = true;
    else if (arg === "--title" && argv[i + 1]) out.title = argv[++i];
    else if (arg === "--component" && argv[i + 1]) out.component = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/direct-main-push.mjs --title "Task title" [options]

Options:
  --component <tag>   Label: website | admin | extension | browser
  --deploy-website    After push, dispatch deploy-infra (marketing site)
  --deploy-admin      After push, run npm run admin:deploy:fast
  --skip-push         Track only (issue + PR + sync); do not git push
  --dry-run           Print planned steps only
`);
      process.exit(0);
    }
  }
  if (!out.title.trim()) {
    console.error("Missing required --title");
    process.exit(1);
  }
  return out;
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : "pipe",
    env: process.env,
  });
  if (result.status !== 0 && !opts.allowFail) {
    const err = result.stderr?.trim() || result.stdout?.trim() || `${cmd} failed`;
    throw new Error(err);
  }
  return result;
}

function gh(args, opts = {}) {
  const result = run("gh", args, { ...opts, allowFail: opts.allowFail });
  return (result.stdout ?? "").trim();
}

function currentBranch() {
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
}

function shortSha(ref = "HEAD") {
  return run("git", ["rev-parse", "--short", ref]).stdout.trim();
}

const args = parseArgs(process.argv);
const config = loadProcedureConfig();

if (args.dryRun) {
  console.log(
    JSON.stringify(
      {
        title: args.title,
        component: args.component,
        deployWebsite: args.deployWebsite,
        deployAdmin: args.deployAdmin,
        skipPush: args.skipPush,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (currentBranch() !== "main") {
  console.error(`Must be on main (current: ${currentBranch()})`);
  process.exit(1);
}

const status = run("git", ["status", "--porcelain"]).stdout.trim();
if (status) {
  console.error("Working tree not clean. Commit first, then re-run.");
  console.error(status.split("\n").slice(0, 8).join("\n"));
  process.exit(1);
}

const beforeSha = shortSha("HEAD");

if (!args.skipPush) {
  console.log("→ Pushing main…");
  run("git", ["push", "origin", "main"], { inherit: true });
}

const afterSha = shortSha("HEAD");
console.log(`→ Commit ${afterSha}`);

console.log("→ Procedure + GitHub issue…");
const procArgs = ["scripts/procedure-init.mjs", "--title", args.title, "--branch", "main"];
if (args.component) procArgs.push("--component", args.component);
run("node", procArgs, { inherit: true });

let issueUrl = "";
try {
  const issues = gh([
    "issue",
    "list",
    "--repo",
    `${config.owner}/${config.repo}`,
    "--limit",
    "1",
    "--search",
    `in:title "${args.title}"`,
    "--json",
    "url",
  ]);
  const parsed = JSON.parse(issues || "[]");
  issueUrl = parsed[0]?.url ?? "";
} catch {
  /* optional */
}

console.log("→ Tracking PR (documents direct push on main)…");
const trackBranch = `track/direct-push-${afterSha}`;
try {
  run("git", ["fetch", "origin", "main"], { allowFail: true });
  run("git", ["branch", "-f", trackBranch, `${afterSha}~1`]);
  run("git", ["push", "origin", trackBranch, "--force"], { inherit: true });

  const prBody = [
    "## Direct main push",
    "",
    `This PR documents a fast-path push already on \`main\`.`,
    "",
    `- **Commit:** \`${afterSha}\``,
    `- **Title:** ${args.title}`,
    issueUrl ? `- **Issue:** ${issueUrl}` : "",
    "",
    "Created by `scripts/direct-main-push.mjs` for audit trail on Project #4.",
  ]
    .filter(Boolean)
    .join("\n");

  const prUrl = gh(
    [
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      trackBranch,
      "--title",
      `track: direct main push — ${args.title}`,
      "--body",
      prBody,
    ],
    { allowFail: true },
  );
  if (prUrl) console.log(`✓ Tracking PR: ${prUrl}`);
  else console.log("  (PR may already exist for this branch)");
} catch (err) {
  console.warn("⚠ Tracking PR skipped:", err instanceof Error ? err.message : err);
}

console.log("→ Sync mission-control issues to Project board…");
try {
  run("node", ["scripts/sync-mission-control-issues.mjs", "--add-to-project"], { inherit: true });
} catch (err) {
  console.warn("⚠ sync:tasks failed:", err instanceof Error ? err.message : err);
}

if (args.deployWebsite) {
  console.log("→ Dispatch marketing site deploy…");
  gh([
    "workflow",
    "run",
    "ci-cd.yml",
    "-f",
    "action_type=deploy-infra - Deploy Mission Control admin & marketing site",
    "-f",
    "deploy_website=true",
  ]);
  console.log("  Check: gh run list --workflow=ci-cd.yml");
}

if (args.deployAdmin) {
  console.log("→ Fast admin deploy…");
  run("npm", ["run", "admin:deploy:fast"], { inherit: true });
}

console.log("\n✓ Direct main push complete.");
if (issueUrl) console.log(`  Issue: ${issueUrl}`);
