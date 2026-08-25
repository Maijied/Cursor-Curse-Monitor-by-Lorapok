#!/usr/bin/env node
/**
 * Onboard lorapok.tech sending identities and Email Routing forwards.
 *
 *   export CLOUDFLARE_API_TOKEN=...   # Email Sending + Email Routing Edit
 *   export CLOUDFLARE_ACCOUNT_ID=f049faaf2f67549f5c58837479596a4a
 *   node scripts/setup-email-addresses.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
const opsInbox = process.env.CCM_OPS_INBOX ?? "lorapokdev@gmail.com";

const ADDRESSES = [
  "cursor.monitor@lorapok.tech",
  "cursor.curse.help@lorapok.tech",
];

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN (Email Sending + Email Routing permissions).");
  process.exit(1);
}

function run(args, { allowFail = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: adminDir,
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token },
  });
  if (result.status !== 0 && !allowFail) process.exit(result.status ?? 1);
}

console.log("Enabling Email Sending for lorapok.tech…");
run(["email", "sending", "enable", "lorapok.tech"], { allowFail: true });

console.log("Enabling Email Routing for lorapok.tech…");
run(["email", "routing", "enable", "lorapok.tech"], { allowFail: true });

console.log(`Verifying destination ${opsInbox}…`);
run(["email", "routing", "addresses", "create", opsInbox], { allowFail: true });

for (const address of ADDRESSES) {
  const name = address.split("@")[0].replace(/\./g, "-");
  console.log(`Routing ${address} → ${opsInbox}`);
  run(
    [
      "email",
      "routing",
      "rules",
      "create",
      "lorapok.tech",
      "--name",
      name,
      "--enabled",
      "true",
      "--match-type",
      "literal",
      "--match-field",
      "to",
      "--match-value",
      address,
      "--action-type",
      "forward",
      "--action-value",
      opsInbox,
    ],
    { allowFail: true }
  );
}

console.log("\nOutbound identities ready:");
for (const address of ADDRESSES) {
  console.log(`  • ${address}`);
}
console.log(`Ops copy (BCC + inbound forward): ${opsInbox}`);
console.log("Sync Pages secret if needed: node scripts/enable-mail.mjs");
