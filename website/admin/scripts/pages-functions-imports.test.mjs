import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(root, "..", "functions", "api");

/** Top-level Pages routes live directly under functions/api/*.ts */
const topLevelRoutes = fs
  .readdirSync(apiDir)
  .filter((name) => name.endsWith(".ts") && !name.startsWith("_"));

for (const file of topLevelRoutes) {
  const content = fs.readFileSync(path.join(apiDir, file), "utf8");
  assert.match(
    content,
    /from\s+["']\.\/_shared\//,
    `${file} must import shared modules from ./_shared/ (not ../_shared/)`
  );
  assert.doesNotMatch(
    content,
    /from\s+["']\.\.\/_shared\//,
    `${file} must not use ../_shared/ — breaks Pages Functions bundling`
  );
}

console.log(`pages-functions-imports.test.mjs: OK (${topLevelRoutes.length} top-level routes)`);
