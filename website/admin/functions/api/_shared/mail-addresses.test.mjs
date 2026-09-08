import assert from "node:assert/strict";
import { resolveDefaultOpsForwardTo } from "./mail-addresses.js";

assert.equal(
  resolveDefaultOpsForwardTo({ MAIL_REDIRECT_TO: "Redirect@Example.com" }),
  "redirect@example.com"
);
assert.equal(
  resolveDefaultOpsForwardTo({ ADMIN_MASTER_EMAIL: "Master@Example.com" }),
  "master@example.com"
);
assert.equal(resolveDefaultOpsForwardTo({}), "");

console.log("mail-addresses.test.mjs: OK");
