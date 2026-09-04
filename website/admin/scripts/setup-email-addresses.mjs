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
import { normalizeEmailIdentitiesConfig } from "../functions/api/_shared/email-identities-config.js";
import { syncEmailIdentities } from "../functions/api/_shared/email-identities-sync.js";

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

const apiEnv = {
  CLOUDFLARE_API_TOKEN: wranglerAuth.token ?? process.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_EMAIL_API_TOKEN: process.env.CLOUDFLARE_EMAIL_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: accountId,
};

console.log(`Syncing Email Routing identities → ${opsInbox}…`);
const sync = await syncEmailIdentities(apiEnv, {
  persist: false,
  updatedBy: "setup-email-addresses.mjs",
  config: normalizeEmailIdentitiesConfig({ opsForwardTo: opsInbox }),
});

for (const step of sync.steps) {
  console.log(`${step.ok ? "✓" : "⚠"} ${step.step}: ${step.message}`);
}

for (const row of sync.results) {
  const mark = row.ok ? "✓" : "✗";
  console.log(`${mark} ${row.email} → ${opsInbox} (${row.message})`);
}

if (sync.summary.failed > 0) {
  console.error(`\nSync completed with ${sync.summary.failed} failure(s).`);
  process.exit(1);
}

console.log("\nOutbound identities ready:");
for (const identity of sync.config.identities) {
  console.log(`  • ${identity.email} (${identity.displayName})`);
}
console.log(`Ops copy (BCC + inbound forward): ${opsInbox}`);
console.log("Sync Pages secret if needed: node scripts/enable-mail.mjs");
