#!/usr/bin/env node
/**
 * Sync cursor/cron_secret from cred vault → GitHub admin-production + Cloudflare Pages + worker.
 *
 * One-time store: cred set cursor cron_secret
 *
 * Flags:
 *   --skip-github     Only sync Cloudflare (Pages + worker)
 *   --skip-cloudflare Only set GitHub admin-production secret
 *   --dry-run         Print steps without writing secrets
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCursorCloudflareSecretsFromVault,
  syncCursorCronSecret,
} from "./lib/cred-vault-sync.mjs";
import { resolveLocalMailEnv } from "./lib/resolve-local-mail-env.mjs";
import { syncStatsCronSecrets } from "./lib/stats-cron-deploy.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const adminDir = resolve(scriptDir, "..");
const args = new Set(process.argv.slice(2));
const skipGithub = args.has("--skip-github");
const skipCloudflare = args.has("--skip-cloudflare");
const dryRun = args.has("--dry-run");

function log(step, message) {
  console.log(`\n[stats-cron sync] ${step} ${message}`);
}

function credGetCronSecretInteractive() {
  log("1/4", "Reading cursor/cron_secret via cred (enter vault passphrase if prompted)…");
  const r = spawnSync("cred", ["get", "cursor", "cron_secret"], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (r.status !== 0) {
    console.error(r.stderr?.trim() || "cred get failed");
    return "";
  }
  return r.stdout.trim();
}

function resolveCronSecret() {
  const fromEnv = (process.env.CRON_SECRET ?? "").trim();
  if (fromEnv) {
    log("1/4", "Using CRON_SECRET from environment");
    return fromEnv;
  }

  const fromVault = loadCursorCloudflareSecretsFromVault()?.cronSecret?.trim();
  if (fromVault) {
    log("1/4", "Loaded cursor/cron_secret from gpg cred vault (.cred-vault-passphrase)");
    return fromVault;
  }

  return credGetCronSecretInteractive();
}

function ghSecret(value) {
  log("2/4", "Setting GitHub admin-production secret CRON_SECRET (gh may prompt once)…");
  if (dryRun) {
    console.log("[dry-run] would run: gh secret set CRON_SECRET --env admin-production");
    return;
  }
  const r = spawnSync("gh", ["secret", "set", "CRON_SECRET", "--env", "admin-production"], {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (r.status !== 0) {
    throw new Error(
      "gh secret set CRON_SECRET failed. Run: gh auth login && gh auth refresh -s repo,admin:org"
    );
  }
}

const cronSecret = resolveCronSecret();
if (!cronSecret) {
  console.error(
    "\nNo cron secret found.\n" +
      "  cred set cursor cron_secret\n" +
      "  — or —\n" +
      '  export CRON_SECRET="$(cred get cursor cron_secret)"\n' +
      "  — or — add cursor/cron_secret to gpg vault + .cred-vault-passphrase at repo root"
  );
  process.exit(1);
}

const env = resolveLocalMailEnv(process.env, adminDir);
const deployToken = env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();

if (!skipCloudflare && !deployToken) {
  console.error(
    "\nNeed Cloudflare deploy token. Options:\n" +
      '  export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"\n' +
      "  — or — create .cred-vault-passphrase at repo root\n" +
      "  — or — cd website/admin && npx wrangler login"
  );
  process.exit(1);
}

if (!skipGithub) {
  ghSecret(cronSecret);
  console.log("✓ GitHub secret CRON_SECRET set (admin-production)");
} else {
  log("2/4", "Skipping GitHub (--skip-github)");
}

if (!skipCloudflare) {
  log("3/4", "Syncing CRON_SECRET to Cloudflare Pages + ccm-stats-cron worker (wrangler)…");
  if (dryRun) {
    console.log("[dry-run] would sync Pages + worker secrets");
  } else {
    syncStatsCronSecrets(cronSecret, { deployToken, accountId }, { adminDir, stdio: "inherit" });
    console.log("✓ Pages + worker CRON_SECRET synced");
  }
} else {
  log("3/4", "Skipping Cloudflare (--skip-cloudflare)");
}

log("4/4", "Backing up cron_secret into gpg cred vault (optional)…");
if (!dryRun) {
  const vaultResult = syncCursorCronSecret(cronSecret);
  if (vaultResult.vaultUpdated) {
    console.log("✓ cred vault updated: cursor/cron_secret");
  } else if (vaultResult.reason) {
    console.warn(`ℹ cred vault not updated (${vaultResult.reason})`);
  }
}

console.log("\nDone. CI admin-deploy runs deploy-stats-cron-ci.mjs when CRON_SECRET is in GitHub.");
