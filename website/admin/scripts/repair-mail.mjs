#!/usr/bin/env node
/**
 * Restore Mission Control outbound mail end-to-end.
 *
 * 1. enable-mail.mjs — relay worker + Pages email secret (credential split)
 * 2. npm run build — fresh admin dist
 * 3. wrangler pages deploy — activate MAIL_RELAY service binding
 * 4. verify-mail-setup.mjs — probe REST token (optional sanity check)
 *
 * CI/CD: every push to `main` runs `enable-mail.mjs` + Pages deploy in admin-deploy job.
 * Use this script only for manual repair when CI is blocked or secrets need re-sync.
 *   export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"
 *   export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"
 *   export CLOUDFLARE_ACCOUNT_ID="$(cred get cursor cloudflare_account_id)"
 *   node website/admin/scripts/repair-mail.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requireDeployToken } from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, { cwd = adminDir, allowFail = false } = {}) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }
  return result.status === 0;
}

try {
  requireDeployToken();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

console.log("Step 1/4 — enable-mail (relay worker + Pages email secret)…");
run(process.execPath, [resolve(adminDir, "scripts/enable-mail.mjs")]);

console.log("\nStep 2/4 — build admin panel…");
run("npm", ["run", "build"]);

console.log("\nStep 3/4 — deploy Pages (activates MAIL_RELAY binding in wrangler.toml)…");
const deployed = run(
  "npx",
  [
    "wrangler",
    "pages",
    "deploy",
    "dist",
    "--project-name=cursor-monitor-admin",
    "--branch=main",
    "--commit-dirty=true",
  ],
  { allowFail: true }
);

if (!deployed) {
  console.error("\nPages deploy failed. Relay/secret may be updated but binding needs a deploy:");
  console.error("  cd website/admin && npm run build && npx wrangler pages deploy dist --project-name=cursor-monitor-admin --branch=main");
  process.exit(1);
}

console.log("\nStep 4/4 — verify email token (REST path)…");
run(process.execPath, [resolve(adminDir, "scripts/verify-mail-setup.mjs")], { allowFail: true });

console.log("\nDone. Open Mission Control → Mailbox → Send branded test email.");
console.log("Health should show mailTransport=cloudflare-relay when MAIL_RELAY is bound.");
