#!/usr/bin/env node
/**
 * One-time outbound mail setup for Mission Control (Cloudflare Pages).
 *
 * Prerequisites:
 * - CLOUDFLARE_API_TOKEN with Account → Email Sending + Pages Edit
 * - CLOUDFLARE_ACCOUNT_ID=f049faaf2f67549f5c58837479596a4a (Lorapok Facility)
 *
 * Usage:
 *   export CLOUDFLARE_API_TOKEN=...
 *   export CLOUDFLARE_ACCOUNT_ID=f049faaf2f67549f5c58837479596a4a
 *   node scripts/enable-mail.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const token = process.env.CLOUDFLARE_API_TOKEN ?? "";

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN with Email Sending + Pages permissions.");
  process.exit(1);
}

async function verifyEmailToken(token, accountId) {
  const listRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/domains`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (listRes.status === 401 || listRes.status === 403) {
    console.error(
      "CLOUDFLARE_API_TOKEN cannot access Email Sending (401/403).\n" +
        "Create a dedicated token: My Profile → API Tokens → Create Token\n" +
        "  Permissions: Account → Email Sending → Edit\n" +
        "Then: export CLOUDFLARE_API_TOKEN=<that-token> && node scripts/enable-mail.mjs\n" +
        "And:  gh secret set CLOUDFLARE_EMAIL_API_TOKEN"
    );
    return false;
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
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
    console.error("Send API rejected token (401/403). Use Email Sending → Edit permission.");
    console.error(JSON.stringify(body.errors ?? body).slice(0, 300));
    return false;
  }
  return true;
}

function run(args, { allowFail = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: adminDir,
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token },
  });
  if (result.status !== 0 && !allowFail) process.exit(result.status ?? 1);
}

console.log("Checking token can access Email Sending API…");
const tokenOk = await verifyEmailToken(token, accountId);
if (!tokenOk) {
  console.warn("Continuing to sync Pages secret, but sends will fail until token + domain onboarding are fixed.");
}

console.log("Enabling Email Sending for lorapok.tech…");
run(["email", "sending", "enable", "lorapok.tech"], { allowFail: true });

console.log("Syncing CLOUDFLARE_EMAIL_API_TOKEN Pages secret…");
const put = spawnSync(
  "npx",
  ["wrangler", "pages", "secret", "put", "CLOUDFLARE_EMAIL_API_TOKEN", "--project-name=cursor-monitor-admin"],
  {
    cwd: adminDir,
    input: token,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token },
    stdio: ["pipe", "inherit", "inherit"],
  }
);
if (put.status !== 0) process.exit(put.status ?? 1);

console.log("Done. Redeploy admin or wait for CI, then use Mailbox → Send test email.");
