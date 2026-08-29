import assert from "node:assert/strict";
import {
  classifyWranglerFailure,
  relayWorkerProbeExists,
  resolvePagesPreDeployCooldownSec,
  resolveRetryWaitSec,
  shouldStopPagesDeployRetries,
  wranglerRetryWaitSec,
} from "./lib/deploy-retry.mjs";

// Reproduce the CI failure sequence from 2026-08-27: 429 then 9109/10000 on retries.
const rateLimitOutput =
  "Rate limited. Please wait and consider throttling your request speed [code: 10429]";
const authLockoutOutput =
  "Invalid access token [code: 9109]\nAuthentication error [code: 10000]";

assert.equal(classifyWranglerFailure(rateLimitOutput), "rate-limit");
assert.equal(classifyWranglerFailure(authLockoutOutput), "auth-lockout");

let sawRateLimit = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  const output = attempt === 1 ? rateLimitOutput : authLockoutOutput;
  const failureKind = classifyWranglerFailure(output);
  if (failureKind === "rate-limit") sawRateLimit = true;

  const stop = shouldStopPagesDeployRetries({
    sawRateLimit,
    failureKind,
    attempt,
    maxAttempts: 4,
  });

  if (attempt === 1) {
    assert.equal(stop.stop, false);
    assert.ok(resolveRetryWaitSec(failureKind, attempt, output) >= 90);
  }
  if (attempt === 2) {
    assert.equal(stop.stop, true);
    assert.equal(stop.reason, "auth-lockout-after-rate-limit");
  }
}

// Push-to-main deploy skips mail setup → no pre-deploy cooldown.
assert.equal(
  resolvePagesPreDeployCooldownSec({
    inCi: true,
    skipMailSetup: true,
    mailLightweight: false,
    env: {},
  }),
  0
);

// workflow_dispatch with full mail setup → longer cooldown.
assert.equal(
  resolvePagesPreDeployCooldownSec({
    inCi: true,
    skipMailSetup: false,
    mailLightweight: false,
    env: { CF_DEPLOY_PRE_COOLDOWN_SEC: "90" },
  }),
  90
);

assert.equal(relayWorkerProbeExists(true), true);
assert.equal(relayWorkerProbeExists("rate-limited"), true);
assert.equal(relayWorkerProbeExists(false), false);

assert.ok(wranglerRetryWaitSec("rate-limit", 1) >= 90);
assert.ok(wranglerRetryWaitSec("auth-lockout", 1) >= 120);

console.log("deploy-pages-ci.test.mjs: OK");
