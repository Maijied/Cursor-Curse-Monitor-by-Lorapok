#!/usr/bin/env node
/**
 * Validate workflow_dispatch release inputs before CI spends time on build/deploy.
 *
 * Env:
 *   ACTION_TYPE, TARGET_TAG, RELEASE_CHANNEL, PUBLISH_MARKET
 *   GITHUB_TOKEN — live tag resolution
 *   EXISTING_TAGS — optional space-separated git tags (CI sets from `git tag -l`)
 */
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTagEligibilityMap,
  validateReleaseDispatch,
} from "../website/admin/functions/api/_shared/release-tag-eligibility.js";
import { fetchGitTagNames, fetchLiveChannels } from "../website/admin/functions/api/_shared/live-channels.js";
import { fetchSiteData, liveTagFromSiteData } from "../website/admin/functions/api/_shared/site-data.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { json: false, strict: true };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--no-strict") args.strict = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/validate-release-dispatch.mjs [--json] [--no-strict]

Validates publish-tag / rollback / sync-open-vsx / full-release dispatch inputs.
Exits 1 when --strict (default) and validation fails.`);
      process.exit(0);
    }
  }
  return args;
}

function gitTagExists(tag) {
  const result = spawnSync("git", ["rev-parse", "--verify", `${tag}^{tag}`], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function listGitTags() {
  if (process.env.EXISTING_TAGS) {
    return process.env.EXISTING_TAGS.split(/\s+/).filter(Boolean);
  }
  const result = spawnSync("git", ["tag", "-l", "v*"], { encoding: "utf8", cwd: root });
  if (result.status !== 0) return [];
  return result.stdout.split(/\s+/).filter(Boolean);
}

async function resolveLiveTag() {
  try {
    const siteData = await fetchSiteData({ SITE_DATA_URL: process.env.SITE_DATA_URL });
    const live = liveTagFromSiteData(siteData);
    if (live) return live;
  } catch {
    // fall through to marketplace channels
  }

  const channels = await fetchLiveChannels(
    {
      extensionName: "cursor-curse-monitor-by-lorapok",
      vsceExtensionId: "LorapokLabs.cursor-curse-monitor-by-lorapok",
      packageVersion: "0.0.0",
      version: "0.0.0",
      ovsx: {},
      ovsxDuplicate: {},
      vscode: {},
      github: {},
      browserExtension: {},
    },
    { githubToken: process.env.GITHUB_TOKEN },
  );
  const gitChannel = channels.find((c) => c.id === "git-tag");
  return gitChannel?.version ? `v${String(gitChannel.version).replace(/^v/i, "")}` : null;
}

function writeGithubOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

const args = parseArgs(process.argv);
const actionType = process.env.ACTION_TYPE ?? "";
const targetTag = process.env.TARGET_TAG ?? "";
const releaseChannel = process.env.RELEASE_CHANNEL ?? "Production";

const liveTag = await resolveLiveTag();
const gitTags = listGitTags();
const tagExistsInGit = targetTag ? gitTagExists(targetTag) : true;

const result = validateReleaseDispatch({
  actionType,
  targetTag,
  releaseChannel,
  liveTag,
  tagExistsInGit,
});

const publishableTags = buildTagEligibilityMap(gitTags, { liveTag, releaseChannel });
const rollbackSources = Object.values(publishableTags)
  .filter((entry) => entry.rollbackEligible)
  .map((entry) => entry.tag)
  .sort()
  .reverse();
const publishReadyTags = Object.values(publishableTags)
  .filter((entry) => entry.publishReady)
  .map((entry) => entry.tag)
  .sort()
  .reverse();
const metadataReadyTags = Object.values(publishableTags)
  .filter((entry) => entry.metadataReady)
  .map((entry) => entry.tag)
  .sort()
  .reverse();

const payload = {
  checkedAt: new Date().toISOString(),
  actionType,
  targetTag: targetTag || null,
  releaseChannel,
  liveTag,
  ...result,
  rollbackSources,
  publishReadyTags,
  metadataReadyTags,
};

if (result.ok) {
  console.log(`::notice::${result.summary}`);
  if (rollbackSources.length) {
    console.log(`::notice::Rollback-eligible tags: ${rollbackSources.slice(0, 8).join(", ")}`);
  }
  if (publishReadyTags.length) {
    console.log(`::notice::Publish-ready tags: ${publishReadyTags.slice(0, 8).join(", ")}`);
  }
  if (metadataReadyTags.length) {
    console.log(`::notice::Metadata-ready tags (sync-open-vsx): ${metadataReadyTags.slice(0, 8).join(", ")}`);
  }
} else {
  console.error(`::error::${result.error}`);
  if (rollbackSources.length) {
    console.error(`::error::Rollback-eligible tags: ${rollbackSources.slice(0, 8).join(", ")}`);
  }
  if (publishReadyTags.length) {
    console.error(`::error::Publish-ready tags: ${publishReadyTags.slice(0, 8).join(", ")}`);
  }
}

writeGithubOutput("dispatch_valid", result.ok ? "true" : "false");
writeGithubOutput("live_tag", liveTag ?? "");

if (args.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (!result.ok && args.strict) {
  process.exit(1);
}
