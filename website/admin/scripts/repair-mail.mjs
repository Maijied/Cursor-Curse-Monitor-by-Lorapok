#!/usr/bin/env node
/**
 * Restore Mission Control outbound mail (relay worker + Pages binding + REST secret).
 *
 *   export CLOUDFLARE_API_TOKEN=...          # Workers/Pages deploy
 *   export CLOUDFLARE_EMAIL_API_TOKEN=...    # Account → Email Sending → Edit
 *   export CLOUDFLARE_ACCOUNT_ID=f049faaf2f67549f5c58837479596a4a
 *   node website/admin/scripts/repair-mail.mjs
 *
 * Then redeploy admin (CI admin-deploy or wrangler pages deploy) and use Mailbox → Send test.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enableMail = resolve(adminDir, "scripts/enable-mail.mjs");

const result = spawnSync(process.execPath, [enableMail], {
  cwd: adminDir,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("\nRedeploying Mission Control so MAIL_RELAY binding is active…");
const deploy = spawnSync(
  "npx",
  ["wrangler", "pages", "deploy", "dist", "--project-name=cursor-monitor-admin", "--branch=main", "--commit-dirty=true"],
  {
    cwd: adminDir,
    stdio: "inherit",
    env: process.env,
  }
);

if (deploy.status !== 0) {
  console.error("\nMail relay is restored, but Pages deploy failed. Run admin CI deploy or:");
  console.error("  cd website/admin && npm run build && npx wrangler pages deploy dist --project-name=cursor-monitor-admin --branch=main");
  process.exit(deploy.status ?? 1);
}

console.log("\nDone. Open Mission Control → Mailbox → Send branded test email.");
