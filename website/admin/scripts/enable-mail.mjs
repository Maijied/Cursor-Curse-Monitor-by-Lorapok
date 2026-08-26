#!/usr/bin/env node
/**
 * Outbound mail setup for Mission Control (Cloudflare Pages + ccm-mail-relay Worker).
 *
 * Credential split (loragent-cloudflare-mail-master):
 * - CLOUDFLARE_API_TOKEN — wrangler Pages/Workers deploy only
 * - CLOUDFLARE_EMAIL_API_TOKEN — Email Sending REST (Pages secret); never the deploy token
 *
 * CI/CD: admin-deploy job on push to main runs sync-mail-on-main.mjs (enable + verify).
 * Local one-shot: node website/admin/scripts/repair-mail.mjs
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
  relayWorkerExists,
  requireDeployToken,
  requireEmailToken,
  resolveMailCredentials,
  setGithubActionsOutput,
} from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const relayDir = resolve(adminDir, "workers/mail-relay");
const inCi = process.env.GITHUB_ACTIONS === "true";

const { accountId, deployToken, emailToken } = resolveMailCredentials();

try {
  requireDeployToken();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const hasEmailToken = Boolean(emailToken);
if (!hasEmailToken) {
  if (inCi) {
    console.warn(
      "CI: CLOUDFLARE_EMAIL_API_TOKEN not set in admin-production — skipping REST secret sync.\n" +
        'Sync once: gh secret set CLOUDFLARE_EMAIL_API_TOKEN --env admin-production --body "$(cred get cursor cloudflare_email_api_token)"'
    );
  } else {
    try {
      requireEmailToken();
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
}

async function verifyEmailToken(token, acctId) {
  const probe = await probeEmailSendingToken(token, acctId);
  if (probe.status === 401 || probe.status === 403) {
    console.error(
      "CLOUDFLARE_EMAIL_API_TOKEN cannot access Email Sending (401/403).\n" +
        "Create a dedicated token: Account → Email Sending → Edit\n" +
        "Then: gh secret set CLOUDFLARE_EMAIL_API_TOKEN --env admin-production"
    );
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

let restSynced = false;

if (hasEmailToken) {
  console.log("Checking CLOUDFLARE_EMAIL_API_TOKEN (Email Sending → Edit)…");
  const tokenOk = await verifyEmailToken(emailToken, accountId);
  if (!tokenOk) {
    console.warn(
      "Email token probe failed — REST fallback will not work until token + domain are fixed."
    );
  }

  console.log("Onboarding lorapok.tech for Email Sending (deploy token — needs Zone access)…");
  runWrangler(["email", "sending", "enable", "lorapok.tech"], {
    token: deployToken,
    allowFail: true,
  });
}

console.log("Deploying ccm-mail-relay worker (send_email binding on Worker, not Pages)…");
const relayDeployed = runWrangler(["deploy"], { cwd: relayDir, token: deployToken, allowFail: true });
if (!relayDeployed) {
  console.warn(
    "ccm-mail-relay deploy failed (deploy token may lack Workers Edit).\n" +
      "REST fallback via CLOUDFLARE_EMAIL_API_TOKEN will be used after Pages redeploy if secret is synced."
  );
}

const relayExists = (await relayWorkerExists(deployToken, accountId)) || relayDeployed;

if (hasEmailToken) {
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
  restSynced = true;
}

setGithubActionsOutput("relay_deployed", relayDeployed ? "true" : "false");
setGithubActionsOutput("relay_exists", relayExists ? "true" : "false");
setGithubActionsOutput("rest_ok", restSynced ? "true" : "false");

console.log("\nDone.");
if (inCi) {
  console.log("CI will verify transport, then deploy Pages (activates MAIL_RELAY binding).");
} else {
  console.log("  • Next: node scripts/repair-mail.mjs (build + Pages deploy) or wait for CI on main");
  console.log("  • Verify: node scripts/verify-mail-setup.mjs && Mailbox → Send test email");
}
