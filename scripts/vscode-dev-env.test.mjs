import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  DEFAULT_VSCODE_DEV_ROOT,
  RSYNC_EXCLUDES,
  chromeProfileFor,
  stateDirFor,
  testLogFor,
} from "./lib/vscode-dev-env.mjs";

describe("vscode-dev-env", () => {
  it("defaults to Personal_Projects sandbox path", () => {
    assert.ok(DEFAULT_VSCODE_DEV_ROOT.includes("Personal_Projects"));
    assert.ok(DEFAULT_VSCODE_DEV_ROOT.endsWith("cursor-usage-monitor-vscode-dev"));
  });

  it("excludes Cursor-specific and build artifacts from rsync", () => {
    assert.ok(RSYNC_EXCLUDES.includes(".cursor"));
    assert.ok(RSYNC_EXCLUDES.includes("node_modules"));
    assert.ok(RSYNC_EXCLUDES.includes(".vscode-dev"));
  });

  it("places isolated state under .vscode-dev", () => {
    const root = "/tmp/sandbox";
    assert.equal(stateDirFor(root), join(root, ".vscode-dev"));
    assert.equal(testLogFor(root), join(root, ".vscode-dev", "last-test.log"));
    assert.equal(chromeProfileFor(root), join(root, ".vscode-dev", "chrome-profile"));
  });
});
