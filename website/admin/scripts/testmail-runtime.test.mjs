import assert from "node:assert/strict";
import {
  resolveTestmailRuntimeConfig,
  testmailInboxAddress,
} from "../functions/api/_shared/testmail-runtime.js";

const missing = resolveTestmailRuntimeConfig({});
assert.equal(missing.ok, false);

const ok = resolveTestmailRuntimeConfig({
  TESTMAIL_API_KEY: "key",
  TESTMAIL_NAMESPACE: "61z27",
});
assert.equal(ok.ok, true);
assert.equal(testmailInboxAddress("61z27", "probe-1"), "61z27.probe-1@inbox.testmail.app");

console.log("testmail-runtime.test.mjs: OK");
