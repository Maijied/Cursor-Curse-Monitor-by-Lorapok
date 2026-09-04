#!/usr/bin/env node
/**
 * Verify Cloudflare tokens in cred vault (no secret output).
 *
 * Usage: node website/admin/scripts/verify-cloudflare-cred-vault.mjs
 */
import { decryptCredentialVault } from "./lib/cred-vault-sync.mjs";
import {
  probeDeployToken,
  probeDeployGlobalKey,
  probeEmailSendingToken,
} from "./lib/mail-credentials.mjs";

const mask = (value) =>
  value ? `${String(value).slice(0, 4)}***${String(value).slice(-4)} (${String(value).length} chars)` : "missing";

async function probeToken(label, token, accountId) {
  if (!token) {
    console.log(`${label}: missing`);
    return { label, ok: false };
  }
  const verify = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const deploy = await probeDeployToken(token, accountId);
  const email = await probeEmailSendingToken(token, accountId);
  console.log(`${label}: ${mask(token)}`);
  console.log(`  verify: ${verify.success ? "active" : verify.errors?.[0]?.message ?? "failed"}`);
  console.log(`  deploy: ${deploy.ok ? "ok" : "fail"} (HTTP ${deploy.status}${deploy.via ? ` via ${deploy.via}` : ""})`);
  console.log(`  email: ${email.ok ? "ok" : "fail"} (HTTP ${email.status})`);
  return { label, ok: verify.success || deploy.ok };
}

async function probeGlobal(label, apiKey, email, accountId) {
  if (!apiKey || !email) {
    console.log(`${label}: missing (key=${apiKey ? "set" : "missing"}, email=${email ? "set" : "missing"})`);
    return { label, ok: false };
  }
  const deploy = await probeDeployGlobalKey(apiKey, email, accountId);
  console.log(`${label}: global key ${mask(apiKey)}, email ${mask(email)}`);
  console.log(`  deploy: ${deploy.ok ? "ok" : "fail"} (HTTP ${deploy.status}${deploy.via ? ` via ${deploy.via}` : ""})`);
  return { label, ok: deploy.ok };
}

const vault = decryptCredentialVault();
if (!vault) {
  console.error("Could not decrypt cred vault.");
  process.exit(1);
}

const cursor = vault.cursor ?? {};
const cloudflare = vault.cloudflare ?? {};
const cloudfare = vault.cloudfare ?? {};
const accountId =
  cursor.cloudflare_account_id ?? cloudflare.account_id ?? cloudfare.account_id ?? "f049faaf2f67549f5c58837479596a4a";

console.log("Checking Cloudflare vault keys…\n");

const results = await Promise.all([
  probeToken("cursor.cloudfare_account_access", cursor.cloudfare_account_access, accountId),
  probeToken("cursor.cloudflare_account_access", cursor.cloudflare_account_access, accountId),
  probeToken("cursor.cloudflare_api_token", cursor.cloudflare_api_token, accountId),
  probeToken("cloudflare.api_token", cloudflare.api_token, accountId),
  probeGlobal(
    "cloudfare.cloudfare_global_api_key",
    cloudfare.cloudfare_global_api_key ?? cloudfare.global_api_key,
    cursor.cloudflare_account_email ?? cloudfare.email,
    accountId
  ),
]);

const anyOk = results.some((r) => r.ok);
if (!anyOk) {
  console.log("\nNo working deploy credential found in vault.");
  console.log("Set a long-lived API token or Global API Key:");
  console.log("  cred set cursor cloudflare_api_token");
  console.log("  cred set cloudfare cloudfare_global_api_key");
  console.log("  cred set cursor cloudflare_account_email");
  process.exit(1);
}

console.log("\nAt least one vault credential passed deploy checks.");
