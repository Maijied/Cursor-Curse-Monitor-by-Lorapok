#!/usr/bin/env node
/**
 * Copy scripts/download-totals.mjs → Cloudflare Pages Functions edge module.
 * Keeps website/admin/functions/api/_shared/download-totals.js in sync with CI scripts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "scripts", "download-totals.mjs");
const target = join(root, "website", "admin", "functions", "api", "_shared", "download-totals.js");

function buildOutput() {
  const body = readFileSync(source, "utf8").trimEnd();
  return `/**
 * Edge-compatible download totals (mirrors scripts/download-totals.mjs).
 * Regenerate: npm run sync:download-totals
 */

${body}
`;
}

const check = process.argv.includes("--check");
const output = buildOutput();

if (check) {
  const current = readFileSync(target, "utf8");
  if (current !== `${output}\n`) {
    console.error(
      "download-totals.js is out of sync with scripts/download-totals.mjs — run: npm run sync:download-totals",
    );
    process.exit(1);
  }
  console.log("download-totals edge mirror OK");
  process.exit(0);
}

writeFileSync(target, `${output}\n`, "utf8");
console.log(`Synced ${target} from scripts/download-totals.mjs`);
