#!/usr/bin/env node
/**
 * Verify Mission Control mail credentials from cred vault only (no wrangler OAuth).
 * Masks secrets; probes Resend + Cloudflare deploy/email tokens.
 *
 *   node website/admin/scripts/verify-mail-cred-vault.mjs
 */
import { loadCursorCloudflareSecretsFromVault } from "./lib/cred-vault-sync.mjs";
import {
  pickDeployAuth,
  probeDeployToken,
  probeEmailSendingToken,
  resolveMailCredentials,
  wranglerDeployEnv,
} from "./lib/mail-credentials.mjs";

const mask = (value) =>
  value ? `${String(value).slice(0, 4)}***${String(value).slice(-4)} (${String(value).length} chars)` : "missing";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.warn(`⚠ ${message}`);
}

async function probeResend(apiKey) {
  if (!apiKey?.startsWith("re_")) {
    return { ok: false, reason: "missing or invalid format" };
  }
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}` };
  }
  const body = await res.json().catch(() => ({}));
  const domains = Array.isArray(body?.data) ? body.data.map((d) => d.name).filter(Boolean) : [];
  return { ok: true, domains };
}

const loaded = loadCursorCloudflareSecretsFromVault();
if (!loaded) {
  fail("Could not decrypt cred vault (.cred-vault-passphrase at repo root or CRED_VAULT_PASSPHRASE).");
  process.exit(1);
}

console.log("Cred vault — mail & deploy credentials\n");

const env = {
  CCM_SKIP_CRED_VAULT: "1",
  CLOUDFLARE_ACCOUNT_ID: loaded.accountId,
  CLOUDFLARE_API_TOKEN: loaded.apiToken,
  CLOUDFLARE_EMAIL_API_TOKEN: loaded.emailToken,
  CLOUDFLARE_API_KEY: loaded.globalApiKey,
  CLOUDFLARE_EMAIL: loaded.globalApiEmail,
  RESEND_API_KEY: loaded.resendApiKey,
  RESEND_FROM: loaded.resendFrom,
  CRON_SECRET: loaded.cronSecret,
  ADMIN_MASTER_EMAIL: loaded.adminMasterEmail,
};

console.log("Keys present (masked):");
console.log(`  cursor.cloudflare_api_token     ${mask(loaded.apiToken)}`);
console.log(`  cursor.cloudflare_email_api_token ${mask(loaded.emailToken)}`);
console.log(`  cloudfare.cloudfare_global_api_key ${mask(loaded.globalApiKey)}`);
console.log(`  cursor.cloudflare_account_email  ${loaded.globalApiEmail ? mask(loaded.globalApiEmail) : "missing"}`);
console.log(`  cursor.resend_api_key           ${mask(loaded.resendApiKey)}`);
console.log(`  cursor.resend_from              ${loaded.resendFrom ?? "missing"}`);
console.log(`  cursor.cron_secret              ${mask(loaded.cronSecret)}`);
console.log(`  cursor.admin_master_email       ${loaded.adminMasterEmail ?? "missing"}`);
console.log();

const accountId = loaded.accountId ?? "f049faaf2f67549f5c58837479596a4a";

// Resend — production external delivery
const resend = await probeResend(loaded.resendApiKey);
if (resend.ok) {
  ok(`Resend API key valid${resend.domains?.length ? ` (domains: ${resend.domains.join(", ")})` : ""}`);
} else {
  fail(`Resend API key probe failed: ${resend.reason}`);
}

// Deploy — prefer probed auth, not stale bearer alone
const { auth, probe } = await pickDeployAuth(env);
if (probe.ok && auth) {
  const via = auth.type === "global" ? "Global API Key" : `Bearer (${probe.via ?? "token"})`;
  ok(`Cloudflare deploy credential: ${via}`);
} else {
  fail(`No working Cloudflare deploy credential in vault (HTTP ${probe.status ?? "n/a"})`);
}

if (loaded.apiToken && probe.ok && auth?.type === "global") {
  warn(
    "cursor.cloudflare_api_token is stale/invalid — deploy uses Global API Key. " +
      "Update or remove the old token: cred set cursor cloudflare_api_token"
  );
}

// Email REST — separate from deploy; optional when Resend + MAIL_RELAY handle delivery
if (loaded.emailToken && loaded.emailToken !== loaded.apiToken) {
  const emailProbe = await probeEmailSendingToken(loaded.emailToken, accountId);
  if (emailProbe.ok) ok("Cloudflare Email Sending API token valid");
  else warn(`Cloudflare Email Sending token failed (HTTP ${emailProbe.status}) — Resend/relay still OK for Gmail`);
} else if (loaded.emailToken) {
  const emailProbe = await probeEmailSendingToken(loaded.emailToken, accountId);
  if (emailProbe.ok) ok("Cloudflare Email Sending API token valid (shared with deploy token)");
  else
    warn(
      "cloudflare_email_api_token matches stale deploy token — REST fallback unavailable. " +
        "Set a dedicated token: cred set cursor cloudflare_email_api_token"
    );
} else {
  warn("No CLOUDFLARE_EMAIL_API_TOKEN in vault — OK if Resend + MAIL_RELAY are bound");
}

// Wrangler env shape (what deploy scripts should use)
const wranglerEnv = probe.ok && auth ? wranglerDeployEnv(accountId, auth, env) : env;
const creds = resolveMailCredentials(wranglerEnv);
console.log("\nResolved deploy env (vault-first, no OAuth):");
console.log(`  CLOUDFLARE_API_TOKEN: ${creds.deployToken ? mask(creds.deployToken) : "cleared (using global key)"}`);
console.log(`  CLOUDFLARE_API_KEY:   ${creds.globalApiKey ? mask(creds.globalApiKey) : "missing"}`);
console.log(`  RESEND_API_KEY:       ${wranglerEnv.RESEND_API_KEY ? mask(wranglerEnv.RESEND_API_KEY) : "missing"}`);

console.log("\nProduction path:");
console.log("  External inboxes (Gmail) → Resend (cursor.resend_api_key)");
console.log("  Pages deploy / wrangler  → Global API Key (working) or refresh cloudflare_api_token");
console.log("  Testmail E2E             → disabled by default (Settings → Testmail)");

if (process.exitCode) {
  process.exit(process.exitCode);
}
ok("Vault mail credential check finished.");
