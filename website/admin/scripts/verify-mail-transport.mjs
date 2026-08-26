#!/usr/bin/env node
/**
 * CI gate: outbound mail must have ccm-mail-relay and/or valid REST email token.
 * Used by admin-deploy job (same checks as repair-mail step 4, without Pages deploy).
 */
import {
  probeEmailSendingToken,
  relayWorkerExists,
  requireDeployToken,
  resolveMailCredentials,
  setGithubActionsOutput,
} from "./lib/mail-credentials.mjs";

const { deployToken, accountId, emailToken } = resolveMailCredentials();

try {
  requireDeployToken();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const relayExists = await relayWorkerExists(deployToken, accountId);
let restOk = false;

if (emailToken) {
  const probe = await probeEmailSendingToken(emailToken, accountId);
  restOk = probe.status !== 401 && probe.status !== 403;
  if (restOk) {
    console.log("✓ CLOUDFLARE_EMAIL_API_TOKEN can access Email Sending API");
  } else {
    console.warn(`✗ Email token probe failed (HTTP ${probe.status})`);
  }
} else {
  console.warn("ℹ️  CLOUDFLARE_EMAIL_API_TOKEN not set — REST fallback unavailable");
}

if (relayExists) {
  console.log("✓ ccm-mail-relay worker exists (preferred MAIL_RELAY transport)");
} else {
  console.warn("✗ ccm-mail-relay worker not found on account");
}

setGithubActionsOutput("relay_exists", relayExists ? "true" : "false");
setGithubActionsOutput("rest_ok", restOk ? "true" : "false");

if (relayExists) {
  console.log("::notice::Outbound mail: ccm-mail-relay is available (preferred transport).");
  process.exit(0);
}

if (restOk) {
  console.log("::warning::Deploying without MAIL_RELAY — REST fallback is configured.");
  process.exit(0);
}

console.error(
  "::error::Outbound mail is not configured: ccm-mail-relay is missing and CLOUDFLARE_EMAIL_API_TOKEN is absent or lacks Email Sending permission."
);
console.error("One-time: sync cred vault → GitHub admin-production secrets, then merge to main:");
console.error('  gh secret set CLOUDFLARE_EMAIL_API_TOKEN --env admin-production --body "$(cred get cursor cloudflare_email_api_token)"');
console.error("Or locally: node website/admin/scripts/repair-mail.mjs");
process.exit(1);
