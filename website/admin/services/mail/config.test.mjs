import assert from "node:assert/strict";
import { resolveMailRedirectTo } from "./config.js";

assert.equal(resolveMailRedirectTo({ MAIL_REDIRECT_TO: "Test@Example.com" }), "test@example.com");
assert.equal(
  resolveMailRedirectTo({ MAIL_REDIRECT_TO: "not-an-email", CCM_SKIP_CRED_VAULT: "1" }),
  ""
);
assert.equal(
  resolveMailRedirectTo({ MAIL_REDIRECT_TO: "", CCM_SKIP_CRED_VAULT: "1" }),
  ""
);

const fromVault = resolveMailRedirectTo({});
assert.match(fromVault, /^$|@/);

console.log("services/mail/config.test.mjs: OK");
