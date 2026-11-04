#!/usr/bin/env node
/**
 * Copy MPL license + notices into browser-extension/dist for AMO/XPI and Chrome zip.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const HEADER = `Cursor Curse Monitor by Lorapok — Firefox / Chrome browser extension
Copyright (C) 2026 Mohammad Maizied Hasan Majumder / Lorapok Labs
https://lorapok.tech

Original Lorapok source in this add-on (browser-extension/ and compiled portions of
packages/shared/) is licensed under the Mozilla Public License 2.0.
Repository component boundaries: LICENSING.md at the project root.
The IDE extension (src/) is GPL-3.0-or-later only and is not included in this package.

---

`;

/** @param {string} browserExtRoot */
export function readFirefoxLicenseText(browserExtRoot) {
  const mpl = readFileSync(join(browserExtRoot, "LICENSE.mpl-2.0.txt"), "utf8");
  return HEADER + mpl;
}

/**
 * @param {string} distDir browser-extension/dist
 * @param {string} browserExtRoot browser-extension/
 * @param {string} version semver for source offer
 */
export function syncFirefoxLicenseArtifactsToDist(distDir, browserExtRoot, version) {
  writeFileSync(join(distDir, "LICENSE"), readFirefoxLicenseText(browserExtRoot), "utf8");
  copyFileSync(join(browserExtRoot, "NOTICE.md"), join(distDir, "NOTICE.md"));

  const sourceTemplate = readFileSync(
    join(browserExtRoot, "SOURCE_CODE_NOTICE.txt"),
    "utf8"
  );
  writeFileSync(
    join(distDir, "SOURCE_CODE_NOTICE.txt"),
    sourceTemplate.replaceAll("{{VERSION}}", version),
    "utf8"
  );
}

/** @param {string} distDir */
export function requiredFirefoxDistLicensePaths(distDir) {
  return ["LICENSE", "NOTICE.md", "SOURCE_CODE_NOTICE.txt"];
}

/** @param {string} distDir */
export function assertFirefoxDistLicenseArtifacts(distDir) {
  const errors = [];
  for (const name of requiredFirefoxDistLicensePaths(distDir)) {
    const path = join(distDir, name);
    if (!existsSync(path)) {
      errors.push(`Missing ${name} in ${distDir}`);
    }
  }
  const licensePath = join(distDir, "LICENSE");
  if (existsSync(licensePath)) {
    const text = readFileSync(licensePath, "utf8");
    if (!text.includes("Mozilla Public License")) {
      errors.push("dist/LICENSE must contain Mozilla Public License text");
    }
    if (text.includes("GNU GENERAL PUBLIC LICENSE")) {
      errors.push("dist/LICENSE must not be the IDE GPL file — use MPL for browser dist");
    }
  }
  return errors;
}
