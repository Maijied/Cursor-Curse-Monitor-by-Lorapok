#!/usr/bin/env node
/**
 * Generates amo/amo-metadata.generated.json for web-ext sign.
 * Fills all AMO listing fields from package.json, CHANGELOG, and base metadata.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const base = JSON.parse(
  readFileSync(join(root, "amo", "amo-metadata.base.json"), "utf8")
);

const versionArg = process.argv.find((a) => a.startsWith("--version="));
const version = versionArg?.split("=")[1] || pkg.version;

function extractReleaseNotes(changelog, ver) {
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

const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
const privacyUrl =
  "https://maijied.github.io/Cursor-Curse-Monitor-by-Lorapok/privacy.html";

const metadata = {
  ...base,
  name: {
    "en-US": "Cursor Curse Monitor by Lorapok",
  },
  version: {
    license: "MPL-2.0",
    privacy_policy: privacyUrl,
    release_notes: {
      "en-US": extractReleaseNotes(changelog, version),
    },
    approval_notes: [
      "Cursor Curse Monitor — browser usage dashboard for Cursor AI.",
      "",
      "How to test:",
      "1. Install the extension.",
      "2. Sign in at https://cursor.com/dashboard in the same browser profile.",
      "3. Open the toolbar popup — usage should load within one refresh.",
      "4. Alternatively: Options → paste access token manually.",
      "",
      "Permissions:",
      "- storage/alarms/notifications: local settings and poll schedule.",
      "- cursor.com + api2.cursor.sh: auth capture and usage API only.",
      "",
      "No data is sent to Lorapok servers except opt-in anonymous heartbeat (off by default).",
    ].join("\n"),
  },
};

const out = join(root, "amo", "amo-metadata.generated.json");
writeFileSync(out, JSON.stringify(metadata, null, 2));
console.log("Wrote", out);
