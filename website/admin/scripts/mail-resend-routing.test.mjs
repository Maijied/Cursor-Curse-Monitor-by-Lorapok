import assert from "node:assert/strict";
import { prefersResendFirst } from "../functions/api/_shared/mail.js";

const withResend = { RESEND_API_KEY: "re_test" };
const withoutResend = {};

assert.equal(prefersResendFirst("user@gmail.com", withResend), true);
assert.equal(prefersResendFirst("61z27.tag@inbox.testmail.app", withResend), true);
assert.equal(prefersResendFirst("cursor.monitor@lorapok.tech", withResend), false);
assert.equal(prefersResendFirst("user@gmail.com", withoutResend), false);

console.log("mail-resend-routing.test.mjs: OK");
