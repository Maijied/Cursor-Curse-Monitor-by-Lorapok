import assert from "node:assert/strict";
import {
  classifyWranglerFailure,
  parseRetryAfterSec,
  resolveRetryWaitSec,
  wranglerRetryWaitSec,
} from "./deploy-retry.mjs";

assert.equal(classifyWranglerFailure("Rate limited [code: 10429]"), "rate-limit");
assert.equal(classifyWranglerFailure("Invalid access token [code: 9109]"), "auth-lockout");
assert.equal(classifyWranglerFailure("Authentication error [code: 10000]"), "auth");
assert.equal(classifyWranglerFailure("something else"), "other");

assert.equal(parseRetryAfterSec("Retry-After: 42"), 42);
assert.equal(parseRetryAfterSec("please retry after 90 seconds"), 90);

assert.ok(wranglerRetryWaitSec("rate-limit", 1) >= 40);
assert.ok(wranglerRetryWaitSec("auth-lockout", 1) >= 60);
assert.ok(wranglerRetryWaitSec("auth", 1) >= 35);
assert.equal(resolveRetryWaitSec("rate-limit", 1, "Retry-After: 120"), 120);

console.log("deploy-retry.test.mjs: OK");
