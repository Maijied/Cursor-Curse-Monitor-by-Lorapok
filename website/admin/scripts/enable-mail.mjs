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
import { relayWorkerProbeExists } from "./lib/deploy-retry.mjs";
import {
  pickDeployAuth,
  probeDeployToken,
  probeEmailSendingToken,
  relayWorkerExists,
  requireDeployToken,
  requireEmailToken,
  resolveMailCredentials,
  setGithubActionsOutput,
  wranglerDeployEnv,
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

const { auth: deployAuth } = await pickDeployAuth();
const wranglerEnv = wranglerDeployEnv(accountId, deployAuth, process.env);
const relayGlobalAuth =
  deployAuth.type === "global"
    ? { globalApiKey: deployAuth.apiKey, globalApiEmail: deployAuth.email }
    : deployToken
      ? { bearerToken: deployToken }
      : undefined;

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

function runWrangler(args, { cwd = adminDir, allowFail = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd,
    stdio: "inherit",
    env: wranglerEnv,
  });
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }
  return result.status === 0;
}

if (!inCi) {
  const deployProbe = await probeDeployToken(deployToken, accountId);
  if (!deployProbe.ok) {
    const msg = `Deploy token probe failed (HTTP ${deployProbe.status}${deployProbe.via ? ` via ${deployProbe.via}` : ""})`;
    console.warn(`::warning::${msg} — still attempting wrangler mail setup.`);
  }
} else {
  console.log("::notice::CI: skipping deploy token probe before mail setup (wrangler validates token).");
}

let relayDeployed = false;
let relayExists = false;
let restSynced = false;

if (inCi) {
  const exists = await relayWorkerExists(deployToken, accountId, relayGlobalAuth);
  if (exists === "rate-limited") {
    console.warn(
      "::warning::CI: ccm-mail-relay probe rate-limited — assuming relay exists to avoid extra Cloudflare API calls before Pages deploy."
    );
    relayExists = true;
  } else {
    relayExists = exists === true;
  }
  if (relayExists) {
    console.log("::notice::CI: ccm-mail-relay already exists — skipping worker redeploy.");
  }
}

if (hasEmailToken) {
  console.log("Checking CLOUDFLARE_EMAIL_API_TOKEN (Email Sending → Edit)…");
  const tokenOk = await verifyEmailToken(emailToken, accountId);
  if (tokenOk) {
    restSynced = true;
  } else {
    console.warn(
      "Email token probe failed — REST fallback will not work until token + domain are fixed."
    );
  }

  console.log("Onboarding lorapok.tech for Email Sending (deploy token — needs Zone access)…");
  if (!relayExists || !inCi) {
    runWrangler(["email", "sending", "enable", "lorapok.tech"], {
      allowFail: true,
    });
  } else {
    console.log("::notice::CI: skipping email domain enable — relay already configured.");
  }
}

if (!relayExists) {
  console.log("Deploying ccm-mail-relay worker (send_email binding on Worker, not Pages)…");
  relayDeployed = runWrangler(["deploy"], { cwd: relayDir, allowFail: true });
  if (!relayDeployed) {
    console.warn(
      "ccm-mail-relay deploy failed (deploy token may lack Workers Edit).\n" +
        "REST fallback via CLOUDFLARE_EMAIL_API_TOKEN will be used after Pages redeploy if secret is synced."
    );
  }
  const existsAfterDeploy = await relayWorkerExists(deployToken, accountId, relayGlobalAuth);
  relayExists = relayWorkerProbeExists(existsAfterDeploy) || relayDeployed;
}

if (hasEmailToken && restSynced) {
  console.log("Syncing CLOUDFLARE_EMAIL_API_TOKEN Pages secret (REST fallback for Pages Functions)…");
  const put = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", "CLOUDFLARE_EMAIL_API_TOKEN", "--project-name=cursor-monitor-admin"],
    {
      cwd: adminDir,
      input: emailToken,
      env: wranglerEnv,
      stdio: ["pipe", "inherit", "inherit"],
    }
  );
  if (put.status !== 0) {
    if (inCi) {
      console.warn(
        "::warning::Pages secret sync failed (auth or rate limit) — continuing; REST may already be configured."
      );
    } else {
      process.exit(put.status ?? 1);
    }
  }
}

setGithubActionsOutput("relay_deployed", relayDeployed ? "true" : "false");
setGithubActionsOutput("relay_exists", relayExists ? "true" : "false");
setGithubActionsOutput("rest_ok", restSynced ? "true" : "false");
setGithubActionsOutput(
  "mail_api_lightweight",
  inCi && relayExists && !relayDeployed ? "true" : "false"
);

console.log("\nDone.");
if (inCi) {
  console.log("CI will verify transport, then deploy Pages (activates MAIL_RELAY binding when available).");
} else {
  console.log("  • Next: node scripts/repair-mail.mjs (build + Pages deploy) or wait for CI on main");
  console.log("  • Verify: node scripts/verify-mail-setup.mjs && Mailbox → Send test email");
}
