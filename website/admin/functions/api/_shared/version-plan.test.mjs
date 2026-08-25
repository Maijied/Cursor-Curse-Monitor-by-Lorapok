import assert from "node:assert/strict";
import {
  buildRollbackPlan,
  buildVersionPlan,
  bumpSemver,
  compareSemver,
  maxVersionFromChannels,
  nextRollbackVersion,
  parseRollbackVersion,
} from "./version-plan.js";

assert.equal(compareSemver("1.0.3", "1.0.2"), 1);
assert.equal(bumpSemver("1.0.3", "patch"), "1.0.4");

const channels = [
  { id: "vscode", label: "VS Code", version: "1.0.3" },
  { id: "ovsx", label: "Open VSX", version: "1.0.3" },
  { id: "ovsx-dup", label: "Open VSX dup", version: "1.0.2", warn: true },
  { id: "package", label: "package.json", version: "1.0.1" },
];

assert.equal(maxVersionFromChannels(channels), "1.0.3");

const plan = buildVersionPlan({
  packageVersion: "1.0.1",
  bumpType: "patch",
  channels,
  latestGitTag: "1.0.3",
});

assert.equal(plan.maxAllVersion, "1.0.3");
assert.equal(plan.recommendedVersion, "1.0.4");
assert.equal(plan.recommendedTag, "v1.0.4");

assert.deepEqual(parseRollbackVersion("v1.0.R2"), {
  major: 1,
  minor: 0,
  rollback: 2,
  version: "1.0.R2",
  tag: "v1.0.R2",
});

assert.equal(nextRollbackVersion("1.0.3", ["v1.0.R1"]).recommendedTag, "v1.0.R2");
assert.equal(nextRollbackVersion("1.0.3", []).recommendedTag, "v1.0.R1");

const rollbackPlan = buildRollbackPlan({
  packageVersion: "1.0.3",
  channels,
  existingTags: ["v1.0.3", "v1.0.R1"],
});

assert.equal(rollbackPlan.recommendedTag, "v1.0.R2");
assert.equal(rollbackPlan.planMode, "rollback");

console.log("version-plan.test.mjs: OK");
