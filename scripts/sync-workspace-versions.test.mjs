import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertWorkspacePlaceholders } from "./sync-workspace-versions.mjs";

describe("sync-workspace-versions", () => {
  it("keeps workspace packages at 0.0.0 in git", () => {
    const violations = assertWorkspacePlaceholders();
    assert.deepEqual(violations, []);
  });
});
