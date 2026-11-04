#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFirefoxDistLicenseArtifacts } from "./lib-licensing-artifacts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("::error::browser-extension/dist missing — run npm run browser-ext:build first");
  process.exit(1);
}

const errors = assertFirefoxDistLicenseArtifacts(dist);
if (errors.length) {
  for (const e of errors) console.error("::error::", e);
  process.exit(1);
}

console.log("validate-package-licenses: OK (Firefox/Chrome dist MPL artifacts)");
process.exit(0);
