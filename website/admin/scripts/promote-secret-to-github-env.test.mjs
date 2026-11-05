import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const promoteScript = join(scriptDir, "promote-secret-to-github-env.mjs");

test("promote-secret resolves FB_API_TOKEN alias for CLOUDFLARE_API_TOKEN", () => {
  const dir = mkdtempSync(join(tmpdir(), "gha-promote-"));
  const envFile = join(dir, "env");
  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_ENV = envFile;
  process.env.FB_API_TOKEN = "cf-token-from-fallback";

  const result = spawnSync(process.execPath, [promoteScript, "CLOUDFLARE_API_TOKEN"], {
    env: process.env,
    encoding: "utf8",
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    const body = readFileSync(envFile, "utf8");
    assert.match(body, /^CLOUDFLARE_API_TOKEN<<gha_env_/m);
    assert.match(body, /cf-token-from-fallback/);
  } finally {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_ENV;
    delete process.env.FB_API_TOKEN;
    delete process.env.CLOUDFLARE_API_TOKEN;
    rmSync(dir, { recursive: true, force: true });
  }
});
