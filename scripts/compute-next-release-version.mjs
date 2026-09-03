#!/usr/bin/env node
/**
 * Resolve the next release or rollback version from live marketplace data.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRollbackPlan, buildVersionPlan } from "../website/admin/functions/api/_shared/version-plan.js";
import { fetchGitTagNames, fetchLiveChannels } from "../website/admin/functions/api/_shared/live-channels.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { bump: "patch", field: null, json: false, rollback: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--rollback") args.rollback = true;
    else if (arg === "--field") args.field = argv[++i];
    else if (arg.startsWith("--bump=")) args.bump = arg.split("=")[1];
    else if (arg === "--bump") args.bump = argv[++i] ?? "patch";
  }
  if (!args.rollback && !["patch", "minor", "major"].includes(args.bump)) {
    console.error(`::error::Invalid bump type: ${args.bump}`);
    process.exit(1);
  }
  return args;
}

const siteData = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const siteDataShim = {
  extensionName: "cursor-curse-monitor-by-lorapok",
  vsceExtensionId: "LorapokLabs.cursor-curse-monitor-by-lorapok",
  packageVersion: siteData.version,
  version: siteData.version,
  ovsx: {},
  ovsxDuplicate: {},
  vscode: {},
  github: {},
  browserExtension: {},
};

const args = parseArgs(process.argv);
const channels = await fetchLiveChannels(siteDataShim, {
  githubToken: process.env.GITHUB_TOKEN,
});
const existingTags = process.env.EXISTING_TAGS
  ? process.env.EXISTING_TAGS.split(/\s+/).filter(Boolean)
  : await fetchGitTagNames({ githubToken: process.env.GITHUB_TOKEN });

const latestGitTag = channels.find((c) => c.id === "git-tag")?.version ?? null;
const plan = args.rollback
  ? buildRollbackPlan({
      packageVersion: siteData.version,
      channels,
      existingTags,
      targetTag: process.env.TARGET_TAG ?? null,
    })
  : buildVersionPlan({
      packageVersion: siteData.version,
      channels,
      bumpType: args.bump,
      latestGitTag,
      existingTags,
    });

const payload = {
  checkedAt: new Date().toISOString(),
  bumpType: args.rollback ? "rollback" : args.bump,
  planMode: args.rollback ? "rollback" : "release",
  channels,
  ...plan,
};

if (args.field) {
  const value = payload[args.field];
  if (value == null) {
    console.error(`::error::Field not found: ${args.field}`);
    process.exit(1);
  }
  process.stdout.write(String(value));
} else if (args.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  process.stdout.write(
    `maxAll=${plan.maxAllVersion} recommended=${plan.recommendedVersion} tag=${plan.recommendedTag}\n`,
  );
}
