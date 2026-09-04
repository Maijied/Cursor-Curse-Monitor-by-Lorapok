#!/usr/bin/env node
/**
 * CI: decrypt cred vault with CRED_VAULT_PASSPHRASE and export Cloudflare (and related) env vars.
 *
 * Vault blob: CRED_STORE_GPG_BASE64 (GitHub secret) or CRED_STORE_FILE (local path).
 * Writes to GITHUB_ENV when set; otherwise prints export lines for local dry-run.
 *
 * Usage (GitHub Actions):
 *   env:
 *     CRED_VAULT_PASSPHRASE: ${{ secrets.CRED_VAULT_PASSPHRASE }}
 *     CRED_STORE_GPG_BASE64: ${{ secrets.CRED_STORE_GPG_BASE64 }}
 *   run: node website/admin/scripts/load-cred-vault-env-ci.mjs
 */
import { appendFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCursorCloudflareSecretsFromVault } from "./lib/cred-vault-sync.mjs";
import { pickDeployAuth, setGithubActionsOutput } from "./lib/mail-credentials.mjs";

const DEFAULT_VAULT =
  process.env.CRED_STORE_FILE ?? "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";

function materializeVaultFile() {
  const b64 = (process.env.CRED_STORE_GPG_BASE64 ?? "").trim();
  if (b64) {
    const dir = mkdtempSync(join(tmpdir(), "cred-vault-"));
    const vaultPath = join(dir, "credentials.json.gpg");
    writeFileSync(vaultPath, Buffer.from(b64, "base64"));
    return { vaultPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  }
  return { vaultPath: DEFAULT_VAULT, cleanup: () => {} };
}

function exportEnv(name, value) {
  if (!value) return;
  const file = process.env.GITHUB_ENV;
  if (file) {
    const escaped = String(value).replace(/\n/g, "\\n").replace(/%/g, "%25");
    appendFileSync(file, `${name}=${escaped}\n`);
  } else {
    console.log(`export ${name}='${String(value).replace(/'/g, "'\\''")}'`);
  }
}

async function main() {
  if (!process.env.CRED_VAULT_PASSPHRASE?.trim() && !process.env.CRED_PASSPHRASE?.trim()) {
    console.log("::notice::CRED_VAULT_PASSPHRASE not set — skipping vault decrypt (using workflow secrets).");
    return;
  }

  const { vaultPath, cleanup } = materializeVaultFile();
  process.env.CRED_STORE_FILE = vaultPath;

  try {
    const loaded = loadCursorCloudflareSecretsFromVault();
    if (!loaded) {
      console.warn("::warning::Cred vault decrypt failed or vault empty — falling back to workflow secrets.");
      return;
    }

    if (loaded.accountId) exportEnv("CLOUDFLARE_ACCOUNT_ID", loaded.accountId);
    if (loaded.cronSecret) exportEnv("CRON_SECRET", loaded.cronSecret);
    if (loaded.githubToken) exportEnv("GITHUB_TOKEN", loaded.githubToken);
    if (loaded.resendApiKey) exportEnv("RESEND_API_KEY", loaded.resendApiKey);
    if (loaded.testmailApiKey) exportEnv("TESTMAIL_API_KEY", loaded.testmailApiKey);
    if (loaded.testmailNamespace) exportEnv("TESTMAIL_NAMESPACE", loaded.testmailNamespace);
    if (loaded.emailToken) exportEnv("CLOUDFLARE_EMAIL_API_TOKEN", loaded.emailToken);

    const env = {
      ...process.env,
      ...(loaded.accountId ? { CLOUDFLARE_ACCOUNT_ID: loaded.accountId } : {}),
      ...(loaded.apiToken ? { CLOUDFLARE_API_TOKEN: loaded.apiToken } : {}),
      ...(loaded.globalApiKey ? { CLOUDFLARE_API_KEY: loaded.globalApiKey } : {}),
      ...(loaded.globalApiEmail ? { CLOUDFLARE_EMAIL: loaded.globalApiEmail } : {}),
    };

    const { auth, probe } = await pickDeployAuth(env);
    if (auth.type === "bearer" && auth.token) {
      exportEnv("CLOUDFLARE_API_TOKEN", auth.token);
      setGithubActionsOutput("deploy_auth", probe.via ?? "bearer");
      console.log(`::notice::Cred vault: deploy via bearer (${probe.via ?? "probe"}).`);
    } else if (auth.type === "global") {
      exportEnv("CLOUDFLARE_API_KEY", auth.apiKey);
      exportEnv("CLOUDFLARE_EMAIL", auth.email);
      setGithubActionsOutput("deploy_auth", probe.via ?? "global-key");
      console.log(`::notice::Cred vault: deploy via Global API Key (${probe.via ?? "probe"}).`);
    } else {
      console.warn("::warning::Cred vault loaded but no working deploy credential found.");
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(`::error::load-cred-vault-env-ci failed: ${err.message}`);
  process.exit(1);
});
