#!/usr/bin/env node
import assert from "node:assert/strict";
import { clearKvWritePause, markKvWriteQuotaHit } from "./kv-put.js";
import {
  isKvWritesSkippedByEnv,
  resolveMailboxStorage,
  resolveMailAuditStorage,
  shouldBlockKvWritesSync,
} from "./mail-storage.js";

function mockD1() {
  return { prepare: () => ({ bind: () => ({ run: async () => {} }) }) };
}

function mockR2() {
  return { put: async () => {} };
}

assert.equal(resolveMailboxStorage({}), "kv");
assert.equal(resolveMailboxStorage({ ADMIN_D1: mockD1() }), "d1");
assert.equal(resolveMailboxStorage({ ADMIN_D1: mockD1(), CCM_MAIL_STORAGE: "kv" }), "kv");
assert.equal(resolveMailboxStorage({ STATS_R2: mockR2() }), "r2");
assert.equal(resolveMailboxStorage({ ADMIN_D1: mockD1(), STATS_R2: mockR2() }), "d1");

assert.equal(resolveMailAuditStorage({}), "kv");
assert.equal(resolveMailAuditStorage({ STATS_R2: mockR2() }), "r2");
assert.equal(resolveMailAuditStorage({ ADMIN_D1: mockD1() }), "d1");
assert.equal(resolveMailAuditStorage({ STATS_R2: mockR2(), ADMIN_D1: mockD1() }), "r2");
assert.equal(resolveMailAuditStorage({ CCM_MAIL_AUDIT_STORAGE: "d1", STATS_R2: mockR2() }), "d1");

assert.equal(isKvWritesSkippedByEnv({ CCM_SKIP_KV: "1" }), true);
assert.equal(isKvWritesSkippedByEnv({}), false);

clearKvWritePause();
assert.equal(shouldBlockKvWritesSync({}), false);
markKvWriteQuotaHit();
assert.equal(shouldBlockKvWritesSync({}), true);
clearKvWritePause();

console.log("mail-storage.test.mjs: OK");
