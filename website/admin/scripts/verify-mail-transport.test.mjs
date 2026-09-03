import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "verify-mail-transport.mjs");

function run(env) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_ACTIONS: "true",
      CLOUDFLARE_API_TOKEN: "test-deploy-token",
      CLOUDFLARE_ACCOUNT_ID: "f049faaf2f67549f5c58837479596a4a",
      MAIL_RELAY_EXISTS_SETUP: "false",
      CLOUDFLARE_EMAIL_API_TOKEN: "",
      ...env,
    },
  });
}

const resendOnly = run({ RESEND_API_KEY: "re_test_key" });
assert.equal(resendOnly.status, 0, resendOnly.stderr || resendOnly.stdout);
assert.match(resendOnly.stdout, /Resend is configured/i);

const none = run({ RESEND_API_KEY: "" });
assert.equal(none.status, 0, "CI should warn-not-fail when no transport");
assert.match(none.stdout + none.stderr, /RESEND_API_KEY not set/i);

console.log("verify-mail-transport.test.mjs: OK");
