#!/usr/bin/env node
/**
 * Sync procedure/github-labels.json → GitHub repo labels.
 * Optionally remaps legacy labels on open mission-control issues.
 *
 *   node scripts/sync-github-labels.mjs [--remap-issues]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadProcedureConfig, repoRootPath } from "./lib/procedure-config.mjs";

const LABELS_PATH = resolve(repoRootPath(), "procedure/github-labels.json");

function gh(args) {
  const result = spawnSync("gh", args, { encoding: "utf8", env: process.env });
  return {
    ok: (result.status ?? 1) === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function parseArgs(argv) {
  return { remapIssues: argv.includes("--remap-issues") };
}

function upsertLabel({ name, color, description }, repo) {
  const edit = gh([
    "label",
    "edit",
    name,
    "--repo",
    repo,
    "--color",
    color.replace("#", ""),
    "--description",
    description,
  ]);
  if (edit.ok) {
    console.log(`✓ Updated label: ${name}`);
    return;
  }
  const create = gh([
    "label",
    "create",
    name,
    "--repo",
    repo,
    "--color",
    color.replace("#", ""),
    "--description",
    description,
  ]);
  if (create.ok) console.log(`✓ Created label: ${name}`);
  else console.warn(`✗ Label ${name}:`, create.stderr || edit.stderr);
}

function main() {
  const args = parseArgs(process.argv);
  const config = loadProcedureConfig();
  const repo = `${config.owner}/${config.repo}`;
  const { labels, legacyRemap = {} } = JSON.parse(readFileSync(LABELS_PATH, "utf8"));

  for (const label of labels) upsertLabel(label, repo);

  if (!args.remapIssues) return;

  const list = gh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "mission-control",
    "--limit",
    "200",
    "--json",
    "number,labels",
  ]);
  if (!list.ok) {
    console.warn("Could not list issues for remap:", list.stderr);
    return;
  }

  const issues = JSON.parse(list.stdout);
  for (const issue of issues) {
    const names = new Set(issue.labels.map((l) => l.name));
    const add = [];
    for (const [legacy, modern] of Object.entries(legacyRemap)) {
      if (names.has(legacy) && !names.has(modern)) add.push(modern);
    }
    if (!add.length) continue;
    const edit = gh([
      "issue",
      "edit",
      String(issue.number),
      "--repo",
      repo,
      ...add.flatMap((l) => ["--add-label", l]),
    ]);
    if (edit.ok) console.log(`✓ Remapped #${issue.number}: +${add.join(", ")}`);
  }
}

main();
