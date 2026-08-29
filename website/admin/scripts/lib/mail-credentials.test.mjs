import assert from "node:assert/strict";
import {
  requireDeployToken,
  requireEmailToken,
  resolveMailCredentials,
} from "./mail-credentials.mjs";

const noVault = { CCM_SKIP_CRED_VAULT: "1" };

assert.throws(() => requireEmailToken(noVault), /CLOUDFLARE_EMAIL_API_TOKEN/);
assert.doesNotThrow(() =>
  requireEmailToken({ ...noVault, GITHUB_ACTIONS: "true" }, { allowMissingInCi: true })
);
assert.throws(() => requireDeployToken(noVault), /CLOUDFLARE_API_TOKEN/);

const creds = resolveMailCredentials({
  ...noVault,
  CLOUDFLARE_ACCOUNT_ID: "acct",
  CLOUDFLARE_API_TOKEN: "deploy-only",
  CLOUDFLARE_EMAIL_API_TOKEN: "email-only",
});
assert.equal(creds.deployToken, "deploy-only");
assert.equal(creds.emailToken, "email-only");
assert.equal(creds.accountId, "acct");

// Email token must not inherit deploy token
const noEmail = resolveMailCredentials({
  ...noVault,
  CLOUDFLARE_API_TOKEN: "deploy-only",
});
assert.equal(noEmail.emailToken, "");

console.log("mail-credentials.test.mjs: OK");
