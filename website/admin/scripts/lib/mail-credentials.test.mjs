import assert from "node:assert/strict";
import {
  requireDeployToken,
  requireEmailToken,
  resolveMailCredentials,
} from "./mail-credentials.mjs";

assert.throws(() => requireEmailToken({}), /CLOUDFLARE_EMAIL_API_TOKEN/);
assert.doesNotThrow(() =>
  requireEmailToken({ GITHUB_ACTIONS: "true" }, { allowMissingInCi: true })
);
assert.throws(() => requireDeployToken({}), /CLOUDFLARE_API_TOKEN/);

const creds = resolveMailCredentials({
  CLOUDFLARE_ACCOUNT_ID: "acct",
  CLOUDFLARE_API_TOKEN: "deploy-only",
  CLOUDFLARE_EMAIL_API_TOKEN: "email-only",
});
assert.equal(creds.deployToken, "deploy-only");
assert.equal(creds.emailToken, "email-only");
assert.equal(creds.accountId, "acct");

// Email token must not inherit deploy token
const noEmail = resolveMailCredentials({ CLOUDFLARE_API_TOKEN: "deploy-only" });
assert.equal(noEmail.emailToken, "");

console.log("mail-credentials.test.mjs: OK");
