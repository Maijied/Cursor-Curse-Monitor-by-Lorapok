#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "amo", "amo-metadata.generated.json");

if (!existsSync(path)) {
  console.error("Missing", path, "— run generate-amo-metadata.mjs first");
  process.exit(1);
}

const meta = JSON.parse(readFileSync(path, "utf8"));
const required = ["categories", "summary", "description"];
for (const key of required) {
  if (!meta[key]) {
    console.error("Missing required field:", key);
    process.exit(1);
  }
}
if (!meta.version?.license) {
  console.error("Missing version.license");
  process.exit(1);
}
if (!meta.summary["en-US"]?.length) {
  console.error("summary.en-US required");
  process.exit(1);
}
console.log("validate-amo-metadata: OK");
