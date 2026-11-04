#!/usr/bin/env node
/**
 * Validates GPL (IDE) vs MPL (browser) licensing layout before release.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;

function fail(msg) {
  console.error(`::error:: ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

const gplPath = join(root, "LICENSE");
if (!existsSync(gplPath)) {
  fail("Missing root LICENSE (GPL for IDE)");
} else {
  const gpl = readFileSync(gplPath, "utf8");
  if (!gpl.includes("GNU GENERAL PUBLIC LICENSE")) {
    fail("Root LICENSE must be GPL-3.0 text for IDE extension");
  } else {
    ok("Root LICENSE is GPL (IDE)");
  }
}

if (!existsSync(join(root, "LICENSING.md"))) {
  fail("Missing LICENSING.md");
} else {
  ok("LICENSING.md present");
}

const mplText = join(root, "browser-extension", "LICENSE.mpl-2.0.txt");
if (!existsSync(mplText)) {
  fail("Missing browser-extension/LICENSE.mpl-2.0.txt");
} else {
  ok("browser-extension/LICENSE.mpl-2.0.txt present");
}

for (const rel of [
  "browser-extension/NOTICE.md",
  "browser-extension/SOURCE_CODE_NOTICE.txt",
  "packages/shared/LICENSE.md",
]) {
  if (!existsSync(join(root, rel))) fail(`Missing ${rel}`);
  else ok(rel);
}

const amoBase = join(root, "browser-extension/amo/amo-metadata.base.json");
if (existsSync(amoBase)) {
  const base = JSON.parse(readFileSync(amoBase, "utf8"));
  const desc = base.description?.["en-US"] ?? "";
  if (!desc.includes("Mozilla Public License")) {
    fail("amo-metadata.base.json description should state MPL for Firefox listing");
  } else {
    ok("AMO base metadata mentions MPL");
  }
}

const vsixFiles = readdirSync(root).filter((f) => f.endsWith(".vsix"));
for (const vsix of vsixFiles) {
  const listing = execSync(`unzip -Z1 "${join(root, vsix)}"`, { encoding: "utf8" });
  const lines = listing.split("\n");
  const licenseEntry = lines.find(
    (l) => l === "LICENSE" || l === "extension/LICENSE" || l === "extension/LICENSE.txt"
  );
  if (!licenseEntry) {
    fail(`${vsix} must include LICENSE (or extension/LICENSE.txt) at package root`);
  } else {
    ok(`${vsix} includes ${licenseEntry}`);
  }
}

if (errors) {
  console.error(`validate:licenses failed with ${errors} error(s)`);
  process.exit(1);
}
console.log("validate:licenses: OK");
