import assert from "node:assert/strict";
import { buildVersionPlan, bumpSemver, compareSemver } from "./version-plan.js";

assert.equal(compareSemver("1.0.3", "1.0.2"), 1);
assert.equal(bumpSemver("1.0.3", "patch"), "1.0.4");

const plan = buildVersionPlan({
  packageVersion: "1.0.1",
  bumpType: "patch",
  channels: [
    { id: "vscode", label: "VS Code", version: "1.0.3" },
    { id: "ovsx", label: "Open VSX", version: "1.0.3" },
    { id: "package", label: "package.json", version: "1.0.1" },
  ],
});

assert.equal(plan.recommendedVersion, "1.0.4");
assert.equal(plan.needsBump, true);
assert.ok(plan.reasons.some((r) => r.status === "behind"));

console.log("version-plan.test.mjs: OK");
