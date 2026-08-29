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

/**
 * @param {string} text
 * @returns {{ token?: string; apiKey?: string; email?: string } | null}
 */
function parseWranglerAuthJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.token) return { token: String(parsed.token) };
    if (parsed.api_key) {
      return {
        apiKey: String(parsed.api_key),
        email: parsed.email ? String(parsed.email) : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** @type {{ token?: string; apiKey?: string; email?: string }} */
let wranglerAuth = {};
if (process.env.CLOUDFLARE_API_TOKEN) {
  wranglerAuth = { token: process.env.CLOUDFLARE_API_TOKEN };
} else {
  try {
    const r = spawnSync("npx", ["wrangler", "auth", "token", "--json"], {
      encoding: "utf8",
      cwd: adminDir,
    });
    const parsed = parseWranglerAuthJson(`${r.stdout}\n${r.stderr}`);
    if (parsed) wranglerAuth = parsed;
  } catch {}
}

if (!wranglerAuth.token && !wranglerAuth.apiKey) {
  console.error("Set CLOUDFLARE_API_TOKEN (Email Sending + Email Routing permissions).");
  process.exit(1);
}
if (wranglerAuth.apiKey && !wranglerAuth.email) {
  console.error("Wrangler returned Global API Key auth without email; set CLOUDFLARE_API_TOKEN instead.");
  process.exit(1);
}

const opsInbox = process.env.CCM_OPS_INBOX ?? "lorapokdev@gmail.com";
const ADDRESSES = [
  "admin@lorapok.tech",
  "cursor.monitor@lorapok.tech",
  "cursor.curse.help@lorapok.tech",
];

function wranglerEnv() {
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId };
  if (wranglerAuth.token) {
    env.CLOUDFLARE_API_TOKEN = wranglerAuth.token;
    return env;
  }
  env.CLOUDFLARE_API_KEY = wranglerAuth.apiKey;
  if (wranglerAuth.email) env.CLOUDFLARE_EMAIL = wranglerAuth.email;
  return env;
}

function run(args, { allowFail = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: adminDir,
    stdio: "inherit",
    env: wranglerEnv(),
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
