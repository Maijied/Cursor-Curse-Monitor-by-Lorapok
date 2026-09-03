#!/usr/bin/env node
/**
 * CI gate: outbound mail must have ccm-mail-relay, valid REST email token, and/or Resend.
 * Used by admin-deploy job (same checks as repair-mail step 4, without Pages deploy).
 */
import { relayWorkerProbeExists } from "./lib/deploy-retry.mjs";
import {
  probeDeployToken,
  probeEmailSendingToken,
  relayWorkerExists,
  requireDeployToken,
  resolveMailCredentials,
  setGithubActionsOutput,
} from "./lib/mail-credentials.mjs";

const inCi = process.env.GITHUB_ACTIONS === "true";
const { deployToken, accountId, emailToken } = resolveMailCredentials();

try {
  requireDeployToken();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

let relayExists = process.env.MAIL_RELAY_EXISTS_SETUP === "true";

if (inCi) {
  console.log(
    "::notice::CI: using enable-mail relay status (skips redundant Cloudflare worker probes)."
  );
} else {
  const deployProbe = await probeDeployToken(deployToken, accountId);
  if (deployProbe.ok) {
    const exists = await relayWorkerExists(deployToken, accountId);
    relayExists = relayWorkerProbeExists(exists);
  }
}
let restOk = false;
const resendConfigured = Boolean(String(process.env.RESEND_API_KEY ?? "").trim());

if (resendConfigured) {
  console.log("✓ RESEND_API_KEY is set (primary for external recipients on Workers Free)");
} else {
  console.warn("ℹ️  RESEND_API_KEY not set — external subscribers need Resend or Workers Paid");
}

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
setGithubActionsOutput("resend_configured", resendConfigured ? "true" : "false");

if (relayExists) {
  console.log("::notice::Outbound mail: ccm-mail-relay is available (preferred transport).");
  process.exit(0);
}

if (restOk) {
  console.log("::warning::Deploying without MAIL_RELAY — REST fallback is configured.");
  process.exit(0);
}

if (resendConfigured) {
  console.log("::notice::Outbound mail: Resend is configured (Workers Free / external subscribers).");
  process.exit(0);
}

console.error(
  "::error::Outbound mail is not configured: ccm-mail-relay is missing, CLOUDFLARE_EMAIL_API_TOKEN is absent or invalid, and RESEND_API_KEY is not set."
);
console.error("Workers Free: set RESEND_API_KEY on Pages — node website/admin/scripts/setup-resend-secret.mjs");
console.error("Or sync cred vault → GitHub admin-production secrets:");
console.error(
  '  gh secret set CLOUDFLARE_EMAIL_API_TOKEN --env admin-production --body "$(cred get cursor cloudflare_email_api_token)"'
);
console.error('  gh secret set RESEND_API_KEY --env admin-production --body "$(cred get cursor resend_api_key)"');
console.error("Or locally: node website/admin/scripts/repair-mail.mjs");
if (inCi) {
  console.warn(
    "::warning::CI: outbound mail is not verified — admin Pages deploy will continue; run repair-mail.mjs or sync secrets, then redeploy."
  );
  process.exit(0);
}
process.exit(1);
