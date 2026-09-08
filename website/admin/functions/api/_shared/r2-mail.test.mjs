#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  isMailR2Available,
  mailAuditR2Key,
  mailOutboxR2Key,
  putMailR2Json,
  writeMailAuditR2,
  writeMailOutboxArchive,
} from "./r2-mail.js";

function mockR2(store = new Map()) {
  return {
    put: async (key, value, opts) => {
      store.set(key, { value, opts });
    },
    get: async (key) => {
      const row = store.get(key);
      if (!row) return null;
      return { text: async () => row.value };
    },
  };
}

assert.equal(isMailR2Available({}), false);
assert.equal(isMailR2Available({ STATS_R2: mockR2() }), true);
assert.match(mailOutboxR2Key("abc"), /^mail\/outbox\/abc\.json$/);
assert.match(mailAuditR2Key("abc", "2026-03-08T12:00:00.000Z"), /^mail\/audit\/2026-03-08\/abc\.json$/);

const store = new Map();
const env = { STATS_R2: mockR2(store) };

const entry = {
  id: "msg-1",
  ts: "2026-03-08T12:00:00.000Z",
  direction: "outbound",
  to: "user@example.com",
  subject: "Hello",
};

assert.equal(await writeMailOutboxArchive(env, entry), true);
assert.equal(store.size, 1);
assert.ok(store.has(mailOutboxR2Key("msg-1")));

const audit = {
  id: "audit-1",
  ts: "2026-03-08T12:00:00.000Z",
  transport: "resend",
  status: "sent",
  from: "xxx@lorapok.tech",
  to: "u***@example.com",
  subjectPreview: "Hello",
};

assert.equal(await writeMailAuditR2(env, audit), true);
assert.ok(store.has(mailAuditR2Key("audit-1", audit.ts)));

assert.equal(await putMailR2Json(env, "mail/test.json", { ok: true }), true);

console.log("r2-mail.test.mjs: OK");
