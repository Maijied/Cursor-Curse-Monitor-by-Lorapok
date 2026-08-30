#!/usr/bin/env node
/**
 * Compute semver strings for CI and local tooling.
 *
 * Env:
 *   RELEASE_BASE — production base (default 1.0.1)
 *   GITHUB_EVENT_NAME — push | pull_request | workflow_dispatch
 *   GITHUB_SHA — full commit sha
 *   GITHUB_RUN_NUMBER — run number for dev builds
 *   PR_NUMBER — pull request number
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isCli = process.argv[1] === fileURLToPath(import.meta.url);

function readBaseVersion() {
  const ref = process.env.GITHUB_REF ?? "";
  if (ref.startsWith("refs/tags/")) {
    const tagVersion = process.env.GITHUB_REF_NAME?.replace(/^v/, "");
    if (tagVersion) return tagVersion.split("-")[0];
  }
  if (process.env.LIVE_MAX_VERSION) return process.env.LIVE_MAX_VERSION.replace(/^v/, "");
  if (process.env.RELEASE_BASE) return process.env.RELEASE_BASE.replace(/^v/, "");
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const base = String(pkg.version).split("-")[0];
    if (base && base !== "0.0.0") return base;
  } catch {
    // fall through
  }
  return "1.0.1";
}

function commitCount() {
  if (process.env.COMMIT_COUNT) return process.env.COMMIT_COUNT;
  try {
    return execFileSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return process.env.GITHUB_RUN_NUMBER ?? "0";
  }
}

function shortSha() {
  const sha = process.env.GITHUB_SHA ?? "";
  return sha.slice(0, 7) || "local";
}

export function computeVersion(context = {}) {
  const base = context.base ?? readBaseVersion();
  const event = context.event ?? process.env.GITHUB_EVENT_NAME ?? "local";
  const channel = context.channel ?? process.env.VERSION_CHANNEL ?? null;

  if (channel === "production" || event === "tag") {
    return base;
  }

  if (event === "pull_request") {
    const pr = context.prNumber ?? process.env.PR_NUMBER ?? process.env.GITHUB_REF?.match(/\/(\d+)\/merge$/)?.[1] ?? "0";
    return `${base}-pr.${pr}`;
  }

  if (event === "workflow_dispatch" && channel === "beta") {
    return `${base}-beta.${shortSha()}`;
  }

  if (event === "push" || channel === "dev") {
    return `${base}-dev.${commitCount()}`;
  }

  if (channel === "beta") {
    return `${base}-beta.${shortSha()}`;
  }

  return base;
}

if (isCli) {
  process.stdout.write(`${computeVersion()}\n`);
}
