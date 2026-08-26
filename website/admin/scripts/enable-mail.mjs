#!/usr/bin/env node
/**
 * Outbound mail setup for Mission Control (Cloudflare Pages + ccm-mail-relay Worker).
 *
 * Credential split (loragent-cloudflare-mail-master):
 * - CLOUDFLARE_API_TOKEN — wrangler Pages/Workers deploy only
 * - CLOUDFLARE_EMAIL_API_TOKEN — Email Sending REST (Pages secret); never the deploy token
 *
 * Transport on Pages:
 * 1. Preferred: Pages [[services]] MAIL_RELAY → ccm-mail-relay Worker (send_email binding)
 * 2. Fallback: REST via CLOUDFLARE_EMAIL_API_TOKEN secret on Pages Functions
 *
 * Usage:
 *   export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"
 *   export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"
 *   export CLOUDFLARE_ACCOUNT_ID=f049faaf2f67549f5c58837479596a4a
 *   node scripts/enable-mail.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  probeEmailSendingToken,
  requireDeployToken,
  requireEmailToken,
  resolveMailCredentials,
} from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const relayDir = resolve(adminDir, "workers/mail-relay");

const { accountId, deployToken, emailToken } = resolveMailCredentials();

try {
  requireDeployToken();
  requireEmailToken();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

async function verifyEmailToken(token, acctId) {
  const probe = await probeEmailSendingToken(token, acctId);
  if (probe.status === 401 || probe.status === 403) {
    console.error(
      "CLOUDFLARE_EMAIL_API_TOKEN cannot access Email Sending (401/403).\n" +
        "Create a dedicated token: My Profile → API Tokens → Create Token\n" +
        "  Permissions: Account → Email Sending → Edit\n" +
        "Then: gh secret set CLOUDFLARE_EMAIL_API_TOKEN\n" +
        "And:  export CLOUDFLARE_EMAIL_API_TOKEN=\"$(cred get cursor cloudflare_email_api_token)\""
    );
    return false;
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${acctId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: "verify@example.com",
        from: { address: "cursor.monitor@lorapok.tech", name: "CCM Verify" },
        subject: "token probe",
        text: "probe",
      }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    console.error("Send API rejected CLOUDFLARE_EMAIL_API_TOKEN (401/403).");
    console.error(JSON.stringify(body.errors ?? body).slice(0, 300));
    return false;
  }
  return true;
}

function runWrangler(args, { cwd = adminDir, token = deployToken, allowFail = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token },
  });
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }
  return result.status === 0;
}

console.log("Checking CLOUDFLARE_EMAIL_API_TOKEN (Email Sending → Edit)…");
const tokenOk = await verifyEmailToken(emailToken, accountId);
if (!tokenOk) {
  console.warn(
    "Email token probe failed — REST fallback will not work until token + domain are fixed.\n" +
      "Relay path (ccm-mail-relay) may still work if the worker is deployed with send_email."
  );
}

console.log("Onboarding lorapok.tech for Email Sending (email token)…");
runWrangler(["email", "sending", "enable", "lorapok.tech"], {
  token: emailToken,
  allowFail: true,
});

console.log("Deploying ccm-mail-relay worker (send_email binding on Worker, not Pages)…");
const relayDeployed = runWrangler(["deploy"], { cwd: relayDir, token: deployToken, allowFail: true });
if (!relayDeployed) {
  console.warn(
    "ccm-mail-relay deploy failed (deploy token may lack Workers Edit).\n" +
      "REST fallback via CLOUDFLARE_EMAIL_API_TOKEN will be used after Pages redeploy."
  );
}

console.log("Syncing CLOUDFLARE_EMAIL_API_TOKEN Pages secret (REST fallback for Pages Functions)…");
const put = spawnSync(
  "npx",
  ["wrangler", "pages", "secret", "put", "CLOUDFLARE_EMAIL_API_TOKEN", "--project-name=cursor-monitor-admin"],
  {
    cwd: adminDir,
    input: emailToken,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: deployToken },
    stdio: ["pipe", "inherit", "inherit"],
  }
);
if (put.status !== 0) process.exit(put.status ?? 1);

console.log("\nDone.");
console.log("  • Relay preferred: redeploy Pages so MAIL_RELAY binding is active (repair-mail.mjs or CI)");
console.log("  • REST fallback: CLOUDFLARE_EMAIL_API_TOKEN synced to Pages production secret");
console.log("  • Verify: node scripts/verify-mail-setup.mjs && Mailbox → Send test email");
