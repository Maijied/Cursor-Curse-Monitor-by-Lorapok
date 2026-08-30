#!/usr/bin/env node
/**
 * Resolve build and release versions from live marketplace channels.
 * CI runs this first; version:sync propagates the result to every package.json.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVersion } from "./compute-version.mjs";
import { buildVersionPlan, maxVersionFromChannels } from "../website/admin/functions/api/_shared/version-plan.js";
import { fetchGitTagNames, fetchLiveChannels } from "../website/admin/functions/api/_shared/live-channels.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isCli = process.argv[1] === fileURLToPath(import.meta.url);

const SITE_SHIM = {
  extensionName: "cursor-curse-monitor-by-lorapok",
  vsceExtensionId: "LorapokLabs.cursor-curse-monitor-by-lorapok",
  packageVersion: "0.0.0",
  version: "0.0.0",
  ovsx: {},
  ovsxDuplicate: {},
  vscode: {},
  github: {},
  browserExtension: {},
};

function parseArgs(argv) {
  const args = { bump: "patch", field: null, json: false, githubOutput: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--github-output") args.githubOutput = true;
    else if (arg.startsWith("--bump=")) args.bump = arg.split("=")[1];
    else if (arg === "--bump") args.bump = argv[++i] ?? "patch";
    else if (arg === "--field") args.field = argv[++i];
  }
  if (!["patch", "minor", "major"].includes(args.bump)) {
    console.error(`::error::Invalid bump type: ${args.bump}`);
    process.exit(1);
  }
  return args;
}

function readCommittedVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function writeGithubOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

export async function resolveCiVersion(options = {}) {
  const bumpType = options.bump ?? process.env.BUMP_TYPE ?? "patch";
  const githubToken = options.githubToken ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const committedVersion = readCommittedVersion();
  const packageVersion = committedVersion === "0.0.0" ? "0.0.0" : committedVersion.split("-")[0];

  const channels = await fetchLiveChannels(SITE_SHIM, { githubToken });
  const existingTags = process.env.EXISTING_TAGS
    ? process.env.EXISTING_TAGS.split(/\s+/).filter(Boolean)
    : await fetchGitTagNames({ githubToken });
  const latestGitTag = channels.find((c) => c.id === "git-tag")?.version ?? null;
  const liveMax = maxVersionFromChannels(channels);

  const plan = buildVersionPlan({
    packageVersion,
    channels,
    bumpType,
    latestGitTag,
  });

  const buildVersion = computeVersion({
    base: liveMax ?? plan.maxAllVersion ?? "1.0.1",
    event: options.event ?? process.env.GITHUB_EVENT_NAME,
    prNumber: options.prNumber ?? process.env.PR_NUMBER,
    channel: options.channel ?? process.env.VERSION_CHANNEL,
  });

  return {
    checkedAt: new Date().toISOString(),
    bumpType,
    committedVersion,
    liveMax,
    maxAllVersion: plan.maxAllVersion,
    buildVersion,
    recommendedVersion: plan.recommendedVersion,
    recommendedTag: plan.recommendedTag,
    channels,
  };
}

if (isCli) {
  const args = parseArgs(process.argv);
  const payload = await resolveCiVersion({ bump: args.bump });

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
      `liveMax=${payload.liveMax} build=${payload.buildVersion} recommended=${payload.recommendedVersion} tag=${payload.recommendedTag}\n`,
    );
  }

  if (args.githubOutput) {
    writeGithubOutput("live_max", payload.liveMax ?? "");
    writeGithubOutput("build_version", payload.buildVersion ?? "");
    writeGithubOutput("recommended_version", payload.recommendedVersion ?? "");
    writeGithubOutput("recommended_tag", payload.recommendedTag ?? "");
    writeGithubOutput("max_all_version", payload.maxAllVersion ?? "");
  }
}
