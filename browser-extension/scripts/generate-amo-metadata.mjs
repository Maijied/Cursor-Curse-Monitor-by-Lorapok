#!/usr/bin/env node
/**
 * Generates amo/amo-metadata.generated.json for web-ext sign.
 * Fills all AMO listing fields from package.json, CHANGELOG, and base metadata.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveExtensionVersion } from "./lib-version.mjs";
import { extractReleaseNotes } from "./lib-changelog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(root, "..");
const base = JSON.parse(
  readFileSync(join(root, "amo", "amo-metadata.base.json"), "utf8")
);

const versionArg = process.argv.find((a) => a.startsWith("--version="));
const version = versionArg?.split("=")[1] || resolveExtensionVersion(root);

const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
const privacyUrl = "https://cursor.lorapok.tech/privacy.html";

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
