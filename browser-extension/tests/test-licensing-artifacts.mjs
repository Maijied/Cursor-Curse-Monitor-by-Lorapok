#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertFirefoxDistLicenseArtifacts,
  readFirefoxLicenseText,
  syncFirefoxLicenseArtifactsToDist,
} from "../scripts/lib-licensing-artifacts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const text = readFirefoxLicenseText(root);
assert.match(text, /Mozilla Public License Version 2\.0/);
assert.doesNotMatch(text, /GNU GENERAL PUBLIC LICENSE/);

const stage = mkdtempSync(join(tmpdir(), "ccm-lic-"));
syncFirefoxLicenseArtifactsToDist(stage, root, "1.0.0-test");
const errors = assertFirefoxDistLicenseArtifacts(stage);
assert.equal(errors.length, 0, errors.join("; "));
assert.match(readFileSync(join(stage, "SOURCE_CODE_NOTICE.txt"), "utf8"), /v1\.0\.0-test/);
rmSync(stage, { recursive: true, force: true });

console.log("test-licensing-artifacts.mjs: OK");
