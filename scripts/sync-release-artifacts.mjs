#!/usr/bin/env node
/** CLI: sync site-data/seo/index.html with root package.json version. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncReleaseArtifactVersions } from "./lib-sync-release-artifacts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const result = await syncReleaseArtifactVersions(root, pkg.version, pkg, {
  githubToken: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
});

console.log(
  `Synced release artifacts for v${pkg.version} (${result.releaseStatus}, published ${result.publishedReleaseVersion ?? "none"})`,
);
