/**
 * Shared CHANGELOG section extraction for AMO metadata and browser extension build.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} changelog
 * @param {string} ver
 */
export function extractReleaseNotes(changelog, ver) {
  const heading = `## [${ver}]`;
  const alt = `## ${ver}`;
  const idx = changelog.indexOf(heading) >= 0
    ? changelog.indexOf(heading)
    : changelog.indexOf(alt);
  if (idx < 0) {
    return `Version ${ver} — browser extension release.`;
  }
  const rest = changelog.slice(idx);
  const next = rest.search(/\n## /);
  const section = next > 0 ? rest.slice(0, next) : rest;
  return section.replace(/^##[^\n]*\n?/, "").trim() || `Version ${ver}`;
}

/**
 * @param {string} [version]
 * @param {string} [changelogPath]
 */
export function readReleaseNotes(version, changelogPath) {
  const changelog = readFileSync(
    changelogPath ?? join(repoRoot, "CHANGELOG.md"),
    "utf8"
  );
  const ver = version ?? JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8")
  ).version;
  return extractReleaseNotes(changelog, ver);
}
