#!/usr/bin/env node
import assert from "node:assert/strict";
import worker from "../src/index.js";

const r2Store = new Map();

const env = {
  STATS_R2: {
    put: async (key, value, opts) => {
      r2Store.set(key, { value, opts });
    },
  },
};

const res = await worker.fetch(
  new Request("https://internal/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Cursor Monitor <cursor.monitor@lorapok.tech>",
      to: "imaizied@gmail.com",
      subject: "Mailbox test — delivery confirmed",
      transport: "resend",
      status: "sent",
      messageId: "resend-msg-123",
      category: "test",
    }),
  }),
  env
);

assert.equal(res.status, 200);
const body = await res.json();
assert.equal(body.logged, true);
assert.equal(r2Store.size, 1);

const record = JSON.parse([...r2Store.values()][0].value);
assert.equal(record.from, "Cursor Monitor <xxx@lorapok.tech>");
assert.equal(record.to, "i***@gmail.com");
assert.equal(record.transport, "resend");
assert.equal(record.messageId, "resend-msg-123");
assert.match(record.subjectPreview, /Mailbox test/);

const bad = await worker.fetch(new Request("https://internal/log", { method: "GET" }), env);
assert.equal(bad.status, 405);

console.log("mail-audit tests: OK");
