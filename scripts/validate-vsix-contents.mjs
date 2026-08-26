#!/usr/bin/env node
/**
 * Assert the packaged VSIX ships runtime deps and excludes local secrets.
 * Run after: npm run package
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const vsixName = `${pkg.name}-${pkg.version}.vsix`;
const vsixPath = join(root, vsixName);

if (!existsSync(vsixPath)) {
  console.error(`::error::Missing ${vsixName} — run npm run package first.`);
  process.exit(1);
}

const listing = execSync(`unzip -Z1 "${vsixPath}"`, { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const sharedEntry = "extension/vendor/cursor-monitor-shared/dist/index.js";
const forbidden = [
  ".cred-vault-passphrase",
  "extension/.cred-vault-passphrase",
  "extension/website/admin/.cred-vault-passphrase",
];

let failed = false;

if (!listing.includes(sharedEntry)) {
  console.error(
    `::error::VSIX missing ${sharedEntry}. Run npm run compile && npm run package (stage-shared-for-vsix).`
  );
  failed = true;
} else {
  console.log(`✓ VSIX includes ${sharedEntry}`);
}

for (const path of forbidden) {
  if (listing.some((line) => line === path || line.endsWith(`/${path}`))) {
    console.error(`::error::VSIX must not ship secret file: ${path}`);
    failed = true;
  }
}

const extraDev = listing.filter(
  (line) =>
    line.startsWith("extension/.agents/") ||
    line.startsWith("extension/.codex/") ||
    line === "extension/AGENTS.md"
);
if (extraDev.length) {
  console.warn(`::warning::VSIX includes dev/agent files (${extraDev.length}); tighten .vscodeignore.`);
}

if (failed) process.exit(1);
console.log("VSIX contents validation passed.");
