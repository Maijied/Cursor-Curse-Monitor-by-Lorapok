import assert from "node:assert/strict";
import { parseArgs, SYNC_ARTIFACT_PATHS } from "./direct-main-push.mjs";

const base = parseArgs(["node", "direct-main-push.mjs", "--title", "fix(admin): test"]);
assert.equal(base.title, "fix(admin): test");
assert.equal(base.sync, false);
assert.equal(base.deployAdmin, false);

const admin = parseArgs([
  "node",
  "direct-main-push.mjs",
  "--title",
  "x",
  "--sync",
  "--deploy-admin",
  "--watch-ci",
  "--from",
  "feat/foo",
]);
assert.equal(admin.sync, true);
assert.equal(admin.deployAdmin, true);
assert.equal(admin.watchCi, true);
assert.equal(admin.fromBranch, "feat/foo");

const full = parseArgs(["node", "direct-main-push.mjs", "--title", "x", "--deploy-full"]);
assert.equal(full.deployFull, true);
assert.equal(full.deployWebsite, true);
assert.equal(full.deployAdmin, false);

assert.ok(SYNC_ARTIFACT_PATHS.includes("website/site-data.json"));

console.log("direct-main-push.test.mjs: OK");
