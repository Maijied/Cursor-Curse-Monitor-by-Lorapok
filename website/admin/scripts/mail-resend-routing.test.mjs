import assert from "node:assert/strict";
import { prefersResendFirst, resolveResendFromAddress } from "../functions/api/_shared/mail.js";

const withResend = { RESEND_API_KEY: "re_test" };
const withoutResend = {};

assert.equal(prefersResendFirst("user@gmail.com", withResend), true);
assert.equal(
  prefersResendFirst("user@gmail.com", withResend, { workersFreeMode: false, resendFirstExternal: false }),
  false
);
assert.equal(prefersResendFirst("user@gmail.com", withResend, { workersFreeMode: true, resendFirstExternal: false }), true);
assert.equal(prefersResendFirst("61z27.tag@inbox.testmail.app", withResend), true);
assert.equal(prefersResendFirst("cursor.monitor@lorapok.tech", withResend), false);
assert.equal(prefersResendFirst("user@gmail.com", withoutResend), false);

const from = { email: "cursor.monitor@lorapok.tech", name: "Cursor Curse Monitor" };
const mailConfig = { sendingDomain: "mail.lorapok.tech", resendFromOverride: "" };

assert.equal(
  resolveResendFromAddress(from, mailConfig, {}),
  "Cursor Curse Monitor <cursor.monitor@mail.lorapok.tech>"
);
assert.equal(
  resolveResendFromAddress(from, mailConfig, { RESEND_FROM: "Custom <noreply@mail.lorapok.tech>" }),
  "Custom <noreply@mail.lorapok.tech>"
);
assert.equal(
  resolveResendFromAddress(from, { ...mailConfig, resendFromOverride: "KV <kv@mail.lorapok.tech>" }, {}),
  "KV <kv@mail.lorapok.tech>"
);

console.log("mail-resend-routing.test.mjs: OK");
