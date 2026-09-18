/**
 * DEPLOY-04: marketplace deploy must be opt-in and never continuous on push/full-release.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yaml = readFileSync(join(root, ".github/workflows/ci-cd.yml"), "utf8");

/** Extract the `if:` block for a top-level job (multiline `>-` form). */
export function extractJobIf(yamlText, jobId) {
  const lines = yamlText.split("\n");
  let inJob = false;
  let capturing = false;
  const out = [];
  for (const line of lines) {
    if (/^  [a-z][a-z0-9_-]*:\s*$/.test(line)) {
      inJob = line.trim() === `${jobId}:`;
      capturing = false;
      continue;
    }
    if (!inJob) continue;
    if (/^  [a-z]/.test(line) && !line.startsWith("    ")) {
      break;
    }
    if (/^\s+if:\s*>-?\s*$/.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (/^\s+[a-zA-Z_][a-zA-Z0-9_]*:/.test(line) && !/^\s+&&/.test(line) && !/^\s+\(/.test(line)) {
        break;
      }
      out.push(line.trim());
    }
  }
  return out.join(" ");
}

const deployIf = extractJobIf(yaml, "deploy");
assert.ok(deployIf.includes("workflow_dispatch"), "marketplace job must require workflow_dispatch");
assert.ok(
  deployIf.includes("inputs.deploy_extension == true"),
  "marketplace job must be opt-in (deploy_extension == true)"
);
assert.ok(
  deployIf.includes("publish-tag - Publish existing git tag to marketplaces"),
  "publish-tag must be allowed"
);
assert.ok(
  deployIf.includes("rollback - Restore previous tag as a new version"),
  "rollback must be allowed"
);
assert.ok(
  deployIf.includes("sync-open-vsx - Fast sync to Open VSX canonical namespace"),
  "sync-open-vsx must be allowed"
);
assert.ok(
  !deployIf.includes("full-release"),
  "deploy if must not unlock marketplace for full-release"
);
assert.ok(!deployIf.includes("github.event_name == 'push'"), "must not run on push");

const deployExtDefault = yaml.match(
  /deploy_extension:\s*\n(?:.*\n)*?\s+default:\s*(true|false)/
);
assert.ok(deployExtDefault, "deploy_extension input must declare default");
assert.equal(deployExtDefault[1], "false", "deploy_extension default must be false (opt-in)");

const firefox = readFileSync(join(root, ".github/workflows/publish-firefox.yml"), "utf8");
assert.ok(
  firefox.includes("allow_standalone_amo"),
  "standalone AMO workflow must require explicit emergency flag"
);
assert.ok(
  firefox.includes("inputs.allow_standalone_amo == true"),
  "standalone AMO job must gate on allow_standalone_amo"
);

console.log("test_marketplace_deploy_gate.mjs: OK");
