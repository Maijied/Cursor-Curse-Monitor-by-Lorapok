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
  normalizeReleaseTag,
  validateReleaseDispatch,
} from "../website/admin/functions/api/_shared/release-tag-eligibility.js";
import { fetchLiveChannels } from "../website/admin/functions/api/_shared/live-channels.js";
import { fetchSiteData, liveTagFromSiteData } from "../website/admin/functions/api/_shared/site-data.js";
import { compareSemver } from "../website/admin/functions/api/_shared/version-plan.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ACTION_ALIASES = {
  "publish-tag": "publish-tag - Publish existing git tag to marketplaces",
  rollback: "rollback - Restore previous tag as a new version",
  "sync-open-vsx": "sync-open-vsx - Fast sync to Open VSX canonical namespace",
  "full-release": "full-release - Bump version, tag & update Mission Control",
};

function normalizeActionType(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  return ACTION_ALIASES[trimmed] ?? trimmed;
}

function parseArgs(argv) {
  const args = {
    json: false,
    strict: true,
    list: false,
    localOnly: process.env.VALIDATE_DISPATCH_LOCAL_ONLY === "1",
    action: "",
    targetTag: "",
    channel: "Production",
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--no-strict") args.strict = false;
    else if (arg === "--list") args.list = true;
    else if (arg === "--local-only") args.localOnly = true;
    else if (arg === "--action" && argv[i + 1]) args.action = argv[++i];
    else if (arg.startsWith("--action=")) args.action = arg.split("=")[1] ?? "";
    else if (arg === "--target-tag" && argv[i + 1]) args.targetTag = argv[++i];
    else if (arg.startsWith("--target-tag=")) args.targetTag = arg.split("=")[1] ?? "";
    else if (arg === "--channel" && argv[i + 1]) args.channel = argv[++i];
    else if (arg.startsWith("--channel=")) args.channel = arg.split("=")[1] ?? "Production";
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/validate-release-dispatch.mjs [options]

Options:
  --list                 Show rollback / publish / metadata-ready tag inventory (default when no action)
  --action <type>        publish-tag | rollback | sync-open-vsx | full-release (or full CI label)
  --target-tag <tag>     e.g. v1.0.115 (required for publish-tag, rollback, sync-open-vsx)
  --channel <channel>    Production | "Beta (Pre-release)" (default: Production)
  --json                 Print full JSON payload
  --no-strict            Exit 0 even when validation fails
  --local-only           Only use local git tags (skip origin lookup)

Env (CI): ACTION_TYPE, TARGET_TAG, RELEASE_CHANNEL, GITHUB_TOKEN, EXISTING_TAGS
Env (local): VALIDATE_DISPATCH_LOCAL_ONLY=1 — same as --local-only

Examples:
  npm run validate:dispatch
  npm run validate:dispatch -- --action publish-tag --target-tag v1.0.115
  ACTION_TYPE=rollback TARGET_TAG=v1.0.110 npm run validate:dispatch`);
      process.exit(0);
    }
  }
  return args;
}

function parseRemoteTagRefs(stdout) {
  const tags = new Set();
  for (const line of stdout.split("\n")) {
    const ref = line.split(/\t/)[1];
    if (!ref?.startsWith("refs/tags/")) continue;
    tags.add(ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, ""));
  }
  return [...tags];
}

function listRemoteGitTags() {
  const result = spawnSync("git", ["ls-remote", "--tags", "origin", "v*"], {
    encoding: "utf8",
    cwd: root,
  });
  if (result.status !== 0) return [];
  return parseRemoteTagRefs(result.stdout);
}

function gitTagExistsLocally(tag) {
  const result = spawnSync("git", ["rev-parse", "--verify", `${tag}^{tag}`], {
    encoding: "utf8",
    cwd: root,
  });
  return result.status === 0;
}

function gitTagExistsOnRemote(tag) {
  const result = spawnSync("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], {
    encoding: "utf8",
    cwd: root,
  });
  if (result.status !== 0) return false;
  return result.stdout.split("\n").some((line) => line.includes(`refs/tags/${tag}`));
}

function resolveGitTag(tag, { localOnly = false } = {}) {
  if (gitTagExistsLocally(tag)) return { exists: true, source: "local" };
  if (localOnly) return { exists: false, source: null };
  if (gitTagExistsOnRemote(tag)) return { exists: true, source: "remote" };
  return { exists: false, source: null };
}

function listGitTags({ localOnly = false } = {}) {
  if (process.env.EXISTING_TAGS) {
    return process.env.EXISTING_TAGS.split(/\s+/).filter(Boolean);
  }
  const result = spawnSync("git", ["tag", "-l", "v*"], { encoding: "utf8", cwd: root });
  const local = result.status === 0 ? result.stdout.split(/\s+/).filter(Boolean) : [];
  if (localOnly || process.env.GITHUB_ACTIONS) return local;
  const remote = listRemoteGitTags();
  return [...new Set([...local, ...remote])].sort();
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

function logInfo(message) {
  if (process.env.GITHUB_ACTIONS) console.log(`::notice::${message}`);
  else console.log(message);
}

function logError(message) {
  if (process.env.GITHUB_ACTIONS) console.error(`::error::${message}`);
  else console.error(message);
}

const args = parseArgs(process.argv);
const actionType = normalizeActionType(args.action || process.env.ACTION_TYPE);
const targetTag = (args.targetTag || process.env.TARGET_TAG || "").trim();
const releaseChannel = args.channel || process.env.RELEASE_CHANNEL || "Production";
const listMode = args.list || !actionType;

function sortTagsDesc(tags) {
  const core = (tag) => String(tag).replace(/^v/i, "");
  return [...tags].sort((a, b) => compareSemver(core(b), core(a)));
}

function mapEligibleTags(publishableTags, key) {
  return sortTagsDesc(
    Object.values(publishableTags)
      .filter((entry) => entry[key])
      .map((entry) => entry.tag),
  );
}

const liveTag = await resolveLiveTag();
const gitTags = listGitTags({ localOnly: args.localOnly });
const publishableTags = buildTagEligibilityMap(gitTags, { liveTag, releaseChannel });
const rollbackSources = mapEligibleTags(publishableTags, "rollbackEligible");
const publishReadyTags = mapEligibleTags(publishableTags, "publishReady");
const metadataReadyTags = mapEligibleTags(publishableTags, "metadataReady");

if (listMode) {
  const payload = {
    checkedAt: new Date().toISOString(),
    mode: "list",
    releaseChannel,
    liveTag,
    rollbackSources,
    publishReadyTags,
    metadataReadyTags,
  };

  logInfo(`Live tag: ${liveTag ?? "(unknown)"}`);
  logInfo(`Channel: ${releaseChannel}`);
  logInfo(`Rollback-eligible tags: ${rollbackSources.slice(0, 12).join(", ") || "(none)"}`);
  logInfo(`Publish-ready tags: ${publishReadyTags.slice(0, 12).join(", ") || "(none)"}`);
  logInfo(`Metadata-ready tags (sync-open-vsx): ${metadataReadyTags.slice(0, 12).join(", ") || "(none)"}`);
  if (!process.env.GITHUB_ACTIONS) {
    console.log("");
    console.log("Validate a dispatch:");
    console.log("  npm run validate:dispatch -- --action publish-tag --target-tag v1.0.115");
    console.log("  npm run validate:dispatch -- --action rollback --target-tag v1.0.110");
    console.log("  npm run validate:dispatch -- --action sync-open-vsx --target-tag v1.0.115");
  }

  if (args.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}

const tagResolution = targetTag ? resolveGitTag(targetTag, { localOnly: args.localOnly }) : { exists: true, source: null };
const tagExistsInGit = tagResolution.exists;

const result = validateReleaseDispatch({
  actionType,
  targetTag,
  releaseChannel,
  liveTag,
  tagExistsInGit,
});

if (!tagExistsInGit && targetTag) {
  result.ok = false;
  result.error = `Git tag ${normalizeReleaseTag(targetTag)} was not found locally or on origin. Run: git fetch --tags origin`;
}

const payload = {
  checkedAt: new Date().toISOString(),
  actionType,
  targetTag: targetTag || null,
  releaseChannel,
  liveTag,
  tagSource: tagResolution.source,
  ...result,
  rollbackSources,
  publishReadyTags,
  metadataReadyTags,
};

if (result.ok) {
  logInfo(result.summary);
  if (tagResolution.source === "remote") {
    logInfo(`Note: ${normalizeReleaseTag(targetTag)} exists on origin but is not fetched locally (optional: git fetch --tags origin).`);
  }
  if (rollbackSources.length) logInfo(`Rollback-eligible tags: ${rollbackSources.slice(0, 8).join(", ")}`);
  if (publishReadyTags.length) logInfo(`Publish-ready tags: ${publishReadyTags.slice(0, 8).join(", ")}`);
  if (metadataReadyTags.length) {
    logInfo(`Metadata-ready tags (sync-open-vsx): ${metadataReadyTags.slice(0, 8).join(", ")}`);
  }
} else {
  logError(result.error);
  if (rollbackSources.length) logError(`Rollback-eligible tags: ${rollbackSources.slice(0, 8).join(", ")}`);
  if (publishReadyTags.length) logError(`Publish-ready tags: ${publishReadyTags.slice(0, 8).join(", ")}`);
}

writeGithubOutput("dispatch_valid", result.ok ? "true" : "false");
writeGithubOutput("live_tag", liveTag ?? "");

if (args.json) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (!result.ok && args.strict) {
  process.exit(1);
}
