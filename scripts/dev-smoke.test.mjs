import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildChromeLaunchArgs, parseDevSmokeArgv } from "./dev-smoke.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extDist = join(root, "browser-extension", "dist");

describe("dev-smoke", () => {
  it("parses CLI flags", () => {
    const flags = parseDevSmokeArgv(["--quick", "--dry-run", "--no-chrome"]);
    assert.equal(flags.quick, true);
    assert.equal(flags.dryRun, true);
    assert.equal(flags.noChrome, true);
    assert.equal(flags.noIde, false);
  });

  it("builds Chrome launch args with isolated profile", () => {
    const profile = join(root, ".dev-smoke", "chrome-profile");
    const args = buildChromeLaunchArgs(extDist, profile);
    assert.ok(args.some((a) => a.startsWith("--user-data-dir=")));
    assert.ok(args.some((a) => a.startsWith("--load-extension=")));
    assert.ok(args.includes("https://cursor.com/dashboard"));
  });
});
