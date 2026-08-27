import assert from "node:assert/strict";
import {
  classifyWranglerFailure,
  parseRetryAfterSec,
  relayWorkerProbeExists,
  resolvePagesPreDeployCooldownSec,
  resolveRetryWaitSec,
  shouldStopPagesDeployRetries,
  wranglerRetryWaitSec,
} from "./deploy-retry.mjs";

assert.equal(classifyWranglerFailure("Rate limited [code: 10429]"), "rate-limit");
assert.equal(classifyWranglerFailure("Invalid access token [code: 9109]"), "auth-lockout");
assert.equal(classifyWranglerFailure("Authentication error [code: 10000]"), "auth");
assert.equal(classifyWranglerFailure("something else"), "other");

assert.equal(parseRetryAfterSec("Retry-After: 42"), 42);
assert.equal(parseRetryAfterSec("please retry after 90 seconds"), 90);

assert.ok(wranglerRetryWaitSec("rate-limit", 1) >= 90);
assert.ok(wranglerRetryWaitSec("auth-lockout", 1) >= 120);
assert.ok(wranglerRetryWaitSec("auth", 1) >= 90);
assert.equal(resolveRetryWaitSec("rate-limit", 1, "Retry-After: 120"), 120);

assert.equal(relayWorkerProbeExists("rate-limited"), true);
assert.equal(relayWorkerProbeExists(false), false);

assert.equal(
  shouldStopPagesDeployRetries({
    sawRateLimit: true,
    failureKind: "auth-lockout",
    attempt: 2,
    maxAttempts: 4,
  }).reason,
  "auth-lockout-after-rate-limit"
);

assert.equal(
  resolvePagesPreDeployCooldownSec({ inCi: true, skipMailSetup: true, env: {} }),
  45
);

console.log("deploy-retry.test.mjs: OK");
