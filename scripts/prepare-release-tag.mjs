#!/usr/bin/env node
/**
 * On push to main: bump package.json to max(live)+patch, commit, tag, and push.
 * Falls back to a PR when branch protection blocks direct pushes to main.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
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

/** Keep committed site artifacts aligned with package.json without npm ci or live API calls. */
function syncReleaseArtifactVersions(version) {
  const sitePath = join(root, "website/site-data.json");
  const seoPath = join(root, "website/seo.json");
  const site = JSON.parse(readFileSync(sitePath, "utf8"));
  site.version = version;
  site.packageVersion = version;
  if (site.install && typeof site.install === "object") {
    site.install.releaseTag = `./scripts/release.sh ${version}`;
  }
  writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`, "utf8");

  const seo = JSON.parse(readFileSync(seoPath, "utf8"));
  seo.version = version;
  seo.packageVersion = version;
  writeFileSync(seoPath, `${JSON.stringify(seo, null, 2)}\n`, "utf8");
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

function pushMainWithPrFallback(version, tag) {
  const direct = runCapture("git", ["push", "origin", "main"]);
  if (direct.ok) {
    console.log("Pushed version bump directly to main");
    writeOutput("pr_required", "false");
    return;
  }

  console.log("::warning::Direct push to main blocked — opening release PR");
  const branch = `chore/release-v${version}`;

  run("git", ["fetch", "origin", "main"]);
  const headBehindMain = runCapture("git", ["rev-list", "--count", `HEAD..origin/main`]);
  const behindCount = headBehindMain.ok ? Number.parseInt(headBehindMain.output.trim(), 10) || 0 : 0;
  if (behindCount > 0) {
    console.log(`Rebasing release branch onto origin/main (${behindCount} commit(s) behind)`);
    const rebase = runCapture("git", ["rebase", "origin/main"]);
    if (!rebase.ok) {
      console.error(`::error::Failed to rebase release branch onto main\n${rebase.output}`);
      process.exit(1);
    }
  }

  run("git", ["checkout", "-B", branch]);
  const branchPush = runCapture("git", ["push", "origin", branch, "--force-with-lease"]);
  if (!branchPush.ok) {
    console.error(`::error::Failed to push release branch\n${branchPush.output}`);
    process.exit(1);
  }

  const existingPr = runCapture("gh", [
    "pr",
    "list",
    "--head",
    branch,
    "--state",
    "open",
    "--json",
    "number,url",
    "--jq",
    ".[0]",
  ]);
  if (existingPr.ok && existingPr.output.trim()) {
    try {
      const prInfo = JSON.parse(existingPr.output.trim());
      if (prInfo?.number) {
        console.log(`::notice::Release PR already open: ${prInfo.url}`);
        writeOutput("pr_required", "true");
        return;
      }
    } catch {
      // fall through to create
    }
  }

  const pr = runCapture("gh", [
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    branch,
    "--title",
    `chore: release v${version}`,
    "--body",
    `Automated release preparation from CI (highest live version + 1 ${bumpType}).\n\nMerge this PR to land \`${tag}\` on main, then publish from Mission Control → Deploy.`,
  ]);
  if (!pr.ok) {
    if (/not permitted to create or approve pull requests/i.test(pr.output)) {
      console.log(
        `::warning::Could not open release PR automatically — enable workflow PR creation in repo settings or open one manually from ${branch}`
      );
      writeOutput("pr_required", "true");
      return;
    }
    console.error(`::error::Failed to open release PR\n${pr.output}`);
    process.exit(1);
  }
  console.log(pr.output.trim());
  writeOutput("pr_required", "true");
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

if (current === recommended && (tagExists(tag) || remoteTagExists(tag))) {
  console.log(`::notice::Release ${tag} already prepared — skipping tag workflow`);
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

if (current !== recommended) {
  console.log(`Bumping package.json ${current} → ${recommended}`);
  run("npm", ["version", "--no-git-tag-version", recommended]);
  syncReleaseArtifactVersions(recommended);
  run("git", ["add", "package.json", "package-lock.json", "website/site-data.json", "website/seo.json"]);
  run("git", ["commit", "-m", `chore: release v${recommended}`]);
}

if (!tagExists(tag)) {
  console.log(`Creating tag ${tag}`);
  run("git", ["tag", tag]);
}

if (!dryRun) {
  pushTag(tag);
  pushMainWithPrFallback(recommended, tag);
}

console.log(`::notice::Prepared release ${tag} (max live v${plan.maxAllVersion} + ${bumpType})`);
writeOutput("tag", tag);
writeOutput("prepared", "true");
writeOutput("skipped", "false");
