#!/usr/bin/env node
import assert from "node:assert/strict";
import auditWorker from "../../../workers/mail-audit/src/index.js";
import { logResendMailEvent } from "./mail-audit-log.js";

const r2Store = new Map();
const env = {
  STATS_R2: {
    put: async (key, value) => {
      r2Store.set(key, value);
    },
  },
};

const auditEnv = {
  MAIL_AUDIT: {
    fetch: (request) => auditWorker.fetch(request, env),
  },
};

const logged = await logResendMailEvent(auditEnv, {
  from: "Cursor <cursor.monitor@lorapok.tech>",
  to: "subscriber@gmail.com",
  subject: "Integration probe",
  transport: "resend",
  messageId: "resend-int-1",
  category: "subscribe",
});

assert.equal(logged.to, "s***@gmail.com");
assert.equal(r2Store.size, 1);
const stored = JSON.parse([...r2Store.values()][0]);
assert.equal(stored.messageId, "resend-int-1");
assert.equal(stored.category, "subscribe");

console.log("mail-audit-integration.test.mjs: OK");
