#!/usr/bin/env node
/**
 * Verify RESEND_API_KEY on Cloudflare Pages and store it in the gpg cred vault.
 *
 * Cloudflare Pages secret values are encrypted and cannot be exported via API.
 * This script confirms the secret exists on Pages, then writes to vault from:
 *   1. cursor/resend_api_key already in vault (no-op)
 *   2. Pages runtime via /api/cron/resend-vault-bootstrap (needs cursor/cron_secret in vault)
 *   3. RESEND_API_KEY environment variable
 *   4. `cred get cursor resend_api_key` (interactive passphrase)
 *
 *   export RESEND_API_KEY=re_...   # one-time from Resend dashboard if vault is empty
 *   node website/admin/scripts/sync-resend-cred-vault.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCursorCloudflareSecretsFromVault,
  syncCursorVaultKeys,
} from "./lib/cred-vault-sync.mjs";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const project = "cursor-monitor-admin";

function listPagesSecrets(deployToken) {
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "list", "--project-name", project],
    {
      cwd: adminDir,
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_API_TOKEN: deployToken,
      },
    }
  );
  if (r.status !== 0) {
    throw new Error(
      `wrangler pages secret list failed: ${(r.stderr || r.stdout || "").trim() || "unknown"}`
    );
  }
  return r.stdout;
}

function pagesHasResendSecret(listOutput) {
  return /RESEND_API_KEY/i.test(listOutput);
}

function credGetResendKey() {
  const r = spawnSync("cred", ["get", "cursor", "resend_api_key"], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (r.status !== 0) return "";
  return r.stdout.trim();
}

function maskKey(key) {
  const trimmed = String(key ?? "").trim();
  if (trimmed.length <= 8) return "***";
  return `${trimmed.slice(0, 6)}***`;
}

async function fetchResendFromPagesRuntime(cronSecret, baseUrl) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/resend-vault-bootstrap`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.warn(`Pages runtime bootstrap HTTP ${res.status} (deploy admin after adding resend-vault-bootstrap route)`);
    return "";
  }
  const json = await res.json().catch(() => ({}));
  return typeof json?.resendApiKey === "string" ? json.resendApiKey.trim() : "";
}

const existing = loadCursorCloudflareSecretsFromVault();
if (existing?.resendApiKey) {
  console.log(`✓ cred vault already has cursor/resend_api_key (${maskKey(existing.resendApiKey)})`);
  process.exit(0);
}

const mailEnv = await resolveLocalMailEnvAsync(process.env, adminDir);
const deployToken = mailEnv.CLOUDFLARE_API_TOKEN?.trim();
if (!deployToken) {
  console.error("Need Cloudflare deploy auth: cd website/admin && npx wrangler login");
  process.exit(1);
}

const secretList = listPagesSecrets(deployToken);
if (!pagesHasResendSecret(secretList)) {
  console.error(
    "RESEND_API_KEY is not configured on Cloudflare Pages (cursor-monitor-admin). " +
      "Run: node website/admin/scripts/setup-resend-secret.mjs"
  );
  process.exit(1);
}
console.log("✓ Cloudflare Pages has RESEND_API_KEY (value encrypted — cannot export via API)");

let resendKey = String(process.env.RESEND_API_KEY ?? "").trim();
if (!resendKey && existing?.cronSecret) {
  const adminUrl =
    process.env.ADMIN_PUBLIC_URL?.trim() ||
    mailEnv.ADMIN_PUBLIC_URL?.trim() ||
    "https://cursor-dev.lorapok.tech";
  console.log(`Trying Pages runtime bootstrap (${adminUrl})…`);
  resendKey = await fetchResendFromPagesRuntime(existing.cronSecret, adminUrl);
  if (resendKey) {
    console.log(`✓ Loaded RESEND_API_KEY from Pages runtime (${maskKey(resendKey)})`);
  }
}
if (!resendKey) {
  resendKey = credGetResendKey();
}
if (!resendKey) {
  console.error(
    "\nCould not resolve RESEND_API_KEY for vault storage.\n" +
      "Cloudflare encrypts Pages secret values — paste the key once:\n" +
      "  export RESEND_API_KEY=re_...   # from resend.com/api-keys\n" +
      "  node website/admin/scripts/sync-resend-cred-vault.mjs\n" +
      "Or store directly: cred set cursor resend_api_key"
  );
  process.exit(1);
}

const result = syncCursorVaultKeys({ resend_api_key: resendKey });
if (!result.vaultUpdated) {
  console.error(`cred vault update failed: ${result.reason ?? "unknown"}`);
  process.exit(1);
}

console.log(`✓ cred vault updated: cursor/resend_api_key (${maskKey(resendKey)})`);
console.log("Tip: sync to GitHub CI with:");
console.log(
  '  gh secret set RESEND_API_KEY --env admin-production --body "$(cred get cursor resend_api_key)"'
);
