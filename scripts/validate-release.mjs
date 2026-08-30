#!/usr/bin/env node
/** Validate release metadata without publishing or mutating external services. */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const sitePath = join(root, "website", "site-data.json");
const seoPath = join(root, "website", "seo.json");
const indexPath = join(root, "website", "index.html");
const strict = process.argv.includes("--strict") || process.env.RELEASE_STRICT === "1";
let failed = false;

function fail(message) {
  console.error(`::error::${message}`);
  failed = true;
}

function warn(message) {
  console.warn(`::warning::${message}`);
}

function normalized(value) {
  return String(value ?? "").replace(/^v/, "");
}

function readJson(path, label) {
  if (!existsSync(path)) {
    fail(`Missing ${label}: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const workspacePlaceholder = "0.0.0";
const rootIsPlaceholder = pkg.version === workspacePlaceholder;

if (!rootIsPlaceholder && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
  fail(`package.json version is not valid semver: ${pkg.version}`);
}

for (const rel of ["package.json", "browser-extension/package.json", "packages/shared/package.json"]) {
  const wsPath = join(root, rel);
  if (!existsSync(wsPath)) continue;
  const ws = JSON.parse(readFileSync(wsPath, "utf8"));
  if (ws.version !== workspacePlaceholder) {
    fail(
      `${rel} version is "${ws.version}" — keep ${workspacePlaceholder} in git and run npm run version:sync at build time`,
    );
  }
}

const catCheck = spawnSync(process.execPath, ["scripts/validate-extension-categories.mjs"], {
  cwd: root,
  stdio: "inherit",
});
if (catCheck.status !== 0) {
  failed = true;
}

const site = readJson(sitePath, "website/site-data.json");
const seo = readJson(seoPath, "website/seo.json");
const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";

if (rootIsPlaceholder) {
  if (site) {
    warn("root package.json is 0.0.0 — site-data version is resolved at CI build time via version:sync");
  }
} else if (site) {
  if (site.packageVersion !== pkg.version) fail(`site-data packageVersion ${site.packageVersion} does not match package.json ${pkg.version}`);
  if (site.version !== pkg.version) fail(`site-data version ${site.version} does not match package.json ${pkg.version}`);
  if (!new Set(["candidate", "published"]).has(site.releaseStatus)) fail(`site-data releaseStatus is invalid: ${site.releaseStatus}`);
  if (site.releaseStatus === "published" && normalized(site.publishedReleaseVersion) !== normalized(pkg.version)) {
    fail("published site-data release version does not match package.json");
  }
  const releaseTag = normalized(site.github?.releaseTag);
  const packageVersion = normalized(pkg.version);
  const strictRef = process.env.GITHUB_REF_NAME?.replace(/^v/, "");
  if (strict && strictRef && strictRef !== packageVersion) fail(`workflow ref ${strictRef} does not match package.json ${packageVersion}`);
  if (strict && site.releaseStatus !== "published") fail(`strict release validation requires a published GitHub release for ${packageVersion}`);
  if (site.install?.releaseTag !== `./scripts/release.sh ${pkg.version}`) fail("install.releaseTag must point to the package release version");
  if (site.github?.releaseUrl && releaseTag && !site.github.releaseUrl.includes(`/tag/v${releaseTag}`) && site.releaseStatus === "published") {
    fail("github.releaseUrl does not match github.releaseTag");
  }
  if (site.github?.vsixUrl && site.releaseStatus === "published" && !site.github.vsixUrl.includes(`/${site.github.releaseTag}/`)) {
    fail("github.vsixUrl does not match github.releaseTag");
  }
  if (site.syncStatus === "synced" && site.releaseStatus !== "published") fail("site-data cannot claim synced before the package release is published");
  if (site.releaseStatus === "candidate") warn(`package ${pkg.version} is not the latest published GitHub release; marketplace/release drift is reported without being promoted`);
}

if (!rootIsPlaceholder && seo) {
  if (seo.packageVersion !== pkg.version) fail(`seo packageVersion ${seo.packageVersion} does not match package.json ${pkg.version}`);
  const jsonLdVersion = indexHtml.match(/"softwareVersion"\s*:\s*"([^"]+)"/)?.[1];
  if (jsonLdVersion && jsonLdVersion !== seo.version) fail(`index.html softwareVersion ${jsonLdVersion} does not match seo.version ${seo.version}`);
  if (seo.syncStatus === "synced" && seo.version !== pkg.version) fail("SEO cannot claim synced with a non-authoritative release version");
}

if (failed) process.exit(1);
console.log(`Release validation passed (${strict ? "strict" : "candidate"} mode).`);
