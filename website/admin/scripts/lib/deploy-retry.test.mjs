import assert from "node:assert/strict";
import {
  classifyWranglerFailure,
  wranglerRetryWaitSec,
} from "./deploy-retry.mjs";

assert.equal(classifyWranglerFailure("Rate limited [code: 10429]"), "rate-limit");
assert.equal(classifyWranglerFailure("Invalid access token [code: 9109]"), "auth-lockout");
assert.equal(classifyWranglerFailure("Authentication error [code: 10000]"), "auth");
assert.equal(classifyWranglerFailure("something else"), "other");

assert.ok(wranglerRetryWaitSec("rate-limit", 1) >= 90);
assert.ok(wranglerRetryWaitSec("auth-lockout", 1) >= 135);
assert.ok(wranglerRetryWaitSec("auth", 1) >= 75);

console.log("deploy-retry.test.mjs: OK");
