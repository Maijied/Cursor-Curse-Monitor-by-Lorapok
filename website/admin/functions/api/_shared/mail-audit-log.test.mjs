#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildResendAuditEntry, logResendMailEvent } from "./mail-audit-log.js";

const entry = buildResendAuditEntry({
  from: "cursor.monitor@lorapok.tech",
  to: "imaizied@gmail.com",
  subject: "Welcome to CCM",
  transport: "resend",
  messageId: "abc-123",
  category: "subscribe",
  sentBy: "admin@lorapok.tech",
});

assert.equal(entry.from, "xxx@lorapok.tech");
assert.equal(entry.to, "i***@gmail.com");
assert.equal(entry.sentBy, "xxx@lorapok.tech");
assert.equal(entry.messageId, "abc-123");

const r2Store = new Map();
const env = {
  STATS_R2: {
    put: async (key, value) => {
      r2Store.set(key, value);
    },
  },
};

const logged = await logResendMailEvent(env, {
  from: "help@lorapok.tech",
  to: "user@example.com",
  subject: "Test",
  status: "sent",
});

assert.equal(logged.to, "u***@example.com");
assert.equal(r2Store.size, 1);
const key = [...r2Store.keys()][0];
assert.match(key, /^mail\/audit\/\d{4}-\d{2}-\d{2}\//);
const parsed = JSON.parse(r2Store.get(key));
assert.equal(parsed.transport, "resend");

console.log("mail-audit-log.test.mjs: OK");
