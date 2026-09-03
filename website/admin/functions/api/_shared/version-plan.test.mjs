import assert from "node:assert/strict";
import {
  buildRollbackPlan,
  buildVersionPlan,
  bumpSemver,
  compareSemver,
  maxVersionFromChannels,
  maxVersionFromGitTags,
  nextRollbackVersion,
  parseRollbackVersion,
  warnLiveChannelDrift,
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
assert.equal(maxVersionFromGitTags(["v1.0.70", "v1.0.71", "v1.0.R1"]), "1.0.71");

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

const gitTagFallback = buildRollbackPlan({
  packageVersion: null,
  channels: [{ id: "vscode", label: "VS Code", version: null }],
  existingTags: ["v1.0.70", "v1.0.71"],
  targetTag: "v1.0.70",
});
assert.equal(gitTagFallback.maxAllVersion, "1.0.71");
assert.equal(gitTagFallback.recommendedTag, "v1.0.R1");

const targetTagFallback = buildRollbackPlan({
  packageVersion: null,
  channels: [],
  existingTags: [],
  targetTag: "v1.0.55",
});
assert.equal(targetTagFallback.maxAllVersion, "1.0.55");
assert.equal(targetTagFallback.recommendedTag, "v1.0.R1");

const warnings = [];
warnLiveChannelDrift({
  packageVersion: "1.0.57",
  channels: [
    { id: "github", version: "1.0.58" },
    { id: "ovsx", version: "1.0.58" },
    { id: "vscode", version: "1.0.57" },
  ],
  log: { warn: (msg) => warnings.push(msg) },
});
assert.ok(warnings.some((w) => w.includes("disagree") && w.includes("1.0.58") && w.includes("1.0.57")));
assert.ok(warnings.some((w) => w.includes("behind highest live")));

warnings.length = 0;
warnLiveChannelDrift({
  packageVersion: "1.0.58",
  channels: [
    { id: "github", version: "1.0.58" },
    { id: "ovsx", version: "1.0.58" },
    { id: "vscode", version: "1.0.58" },
  ],
  log: { warn: (msg) => warnings.push(msg) },
});
assert.equal(warnings.length, 0);

console.log("version-plan.test.mjs: OK");
