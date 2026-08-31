#!/usr/bin/env node
/**
 * Start a tracked task: procedure markdown + GitHub issue (+ optional Project item).
 *
 *   node scripts/procedure-init.mjs --title "Feedback API" --plan plan/foo.md --component admin
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadProcedureConfig,
  procedureDir,
  shortId,
  slugify,
} from "./lib/procedure-config.mjs";

function parseArgs(argv) {
  const out = { title: "", plan: "", component: "", branch: "", dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--title" && argv[i + 1]) out.title = argv[++i];
    else if (arg === "--plan" && argv[i + 1]) out.plan = argv[++i];
    else if (arg === "--component" && argv[i + 1]) out.component = argv[++i];
    else if (arg === "--branch" && argv[i + 1]) out.branch = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/procedure-init.mjs --title "Task title" [options]

Options:
  --plan <path>       Link to plan/ file
  --component <tag>   Extra label (admin, extension, browser, website)
  --branch <name>     Branch name
  --dry-run           Print paths only, do not write or call gh
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

function gh(args, { input } = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    env: process.env,
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const args = parseArgs(process.argv);
const config = loadProcedureConfig();
const id = shortId();
const slug = slugify(args.title);
const fileName = `${id}_${slug}.md`;
const filePath = resolve(procedureDir(), fileName);
const createdAt = new Date().toISOString().slice(0, 10);
const planLink = args.plan ? args.plan : "_none_";
const templatePath = resolve(procedureDir(), "_template.md");

let body = readFileSync(templatePath, "utf8");
body = body
  .replace(/\{title\}/g, args.title)
  .replace(/\{id\}/g, id)
  .replace(/\{createdAt\}/g, createdAt)
  .replace(/\{planLink\}/g, planLink)
  .replace(/\{issueLink\}/g, "__ISSUE_PENDING__")
  .replace(/\{branch\}/g, args.branch || "_TBD_")
  .replace(/\{prLink\}/g, "_TBD_")
  .replace(/\{objective\}/g, args.title);

if (args.dryRun) {
  console.log(JSON.stringify({ filePath, id, slug }, null, 2));
  process.exit(0);
}

writeFileSync(filePath, body, "utf8");
console.log(`✓ Procedure file: procedure/${fileName}`);

const labels = [...new Set([...config.defaultLabels, args.component].filter(Boolean))];
const issueBody = [
  `Procedure: \`procedure/${fileName}\``,
  args.plan ? `Plan: \`${args.plan}\`` : "",
  args.branch ? `Branch: \`${args.branch}\`` : "",
  "",
  "## Tracking",
  "Progress lives in the linked procedure file.",
].filter(Boolean).join("\n");

const issueArgs = [
  "issue",
  "create",
  "--repo",
  `${config.owner}/${config.repo}`,
  "--title",
  args.title,
  "--body",
  issueBody,
];
for (const label of labels) {
  issueArgs.push("--label", label);
}

const issueResult = gh(issueArgs);
if (issueResult.status !== 0) {
  console.warn("⚠ GitHub issue not created:", issueResult.stderr.trim() || issueResult.stdout.trim());
  console.warn("  Create manually: gh issue create --title", JSON.stringify(args.title));
} else {
  const issueUrl = issueResult.stdout.trim();
  console.log(`✓ GitHub issue: ${issueUrl}`);
  const updated = readFileSync(filePath, "utf8").replace(/__ISSUE_PENDING__/g, issueUrl);
  writeFileSync(filePath, updated, "utf8");

  if (config.projectNumber != null && Number.isFinite(config.projectNumber)) {
    const projectAdd = gh([
      "project",
      "item-add",
      String(config.projectNumber),
      "--owner",
      config.owner,
      "--url",
      issueUrl,
    ]);
    if (projectAdd.status === 0) {
      console.log(`✓ Added to Project #${config.projectNumber}`);
    } else {
      console.warn(
        "⚠ Project item-add failed (run: gh auth refresh -s read:project,project):",
        projectAdd.stderr.trim() || projectAdd.stdout.trim()
      );
    }
  }
}

if (!existsSync(filePath)) {
  process.exit(1);
}
