import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { adminDir, repoRoot } from "./deploy-fast.mjs";

assert.ok(existsSync(repoRoot), "repoRoot exists");
assert.ok(existsSync(adminDir), "adminDir exists");
assert.ok(
  existsSync(`${repoRoot}/website/site-data.json`),
  "committed site-data.json required for fast deploy"
);

console.log("deploy-fast.test.mjs: OK");
