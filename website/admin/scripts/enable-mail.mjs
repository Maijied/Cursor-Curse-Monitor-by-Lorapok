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

function run(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: adminDir,
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Enabling Email Sending for lorapok.tech…");
run(["email", "sending", "enable", "lorapok.tech"]);

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
