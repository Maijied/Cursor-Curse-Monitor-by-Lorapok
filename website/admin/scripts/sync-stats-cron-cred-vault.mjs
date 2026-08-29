#!/usr/bin/env node
/**
 * Sync cursor/cron_secret from cred vault → GitHub admin-production + Cloudflare Pages + worker.
 * One-time store: cred set cursor cron_secret
 */
import { spawnSync } from "node:child_process";
import {
  loadCursorCloudflareSecretsFromVault,
  syncCursorCronSecret,
} from "./lib/cred-vault-sync.mjs";
import { tryWranglerOAuthToken } from "./lib/mail-credentials.mjs";
import { syncStatsCronSecrets } from "./lib/stats-cron-deploy.mjs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const adminDir = new URL("..", import.meta.url).pathname;

function credGetCronSecret() {
  const r = spawnSync("cred", ["get", "cursor", "cron_secret"], { encoding: "utf8" });
  if (r.status === 0) {
    const value = r.stdout.trim();
    if (value) return value;
  }
  const vault = loadCursorCloudflareSecretsFromVault();
  return vault?.cronSecret?.trim() || "";
}

function ghSecret(value) {
  const r = spawnSync("gh", ["secret", "set", "CRON_SECRET", "--env", "admin-production"], {
    input: value,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`gh secret set CRON_SECRET failed: ${r.stderr}`);
}

const cronSecret = credGetCronSecret();
if (!cronSecret) {
  console.error(
    "No cron secret found. Store one with: cred set cursor cron_secret\n" +
      "Or add cursor.cron_secret to the gpg vault via .cred-vault-passphrase."
  );
  process.exit(1);
}

const deployToken =
  process.env.CLOUDFLARE_API_TOKEN?.trim() ||
  loadCursorCloudflareSecretsFromVault()?.apiToken ||
  tryWranglerOAuthToken(adminDir);

if (!deployToken) {
  console.error("Need CLOUDFLARE_API_TOKEN, cred vault, or wrangler login.");
  process.exit(1);
}

ghSecret(cronSecret);
console.log("GitHub secret CRON_SECRET set (admin-production)");

syncStatsCronSecrets(cronSecret, { deployToken, accountId });
console.log("Pages + worker CRON_SECRET synced");

const vaultResult = syncCursorCronSecret(cronSecret);
if (vaultResult.vaultUpdated) {
  console.log("cred vault updated: cursor/cron_secret");
} else if (vaultResult.reason) {
  console.warn(`cred vault not updated (${vaultResult.reason})`);
}

console.log("Done. CI admin-deploy will deploy ccm-stats-cron when CRON_SECRET is present.");
