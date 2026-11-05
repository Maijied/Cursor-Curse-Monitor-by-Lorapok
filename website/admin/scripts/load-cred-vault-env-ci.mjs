#!/usr/bin/env node
/**
 * CI: decrypt cred vault with CRED_VAULT_PASSPHRASE and export env vars to GITHUB_ENV.
 *
 * All sensitive values are registered with ::add-mask:: before writing GITHUB_ENV.
 * Multiline values (Firebase service account JSON) use delimiter syntax.
 * Minified single-line secrets also use delimiter syntax so scalar %25 encoding cannot bypass ::add-mask::.
 *
 * Scopes (limits blast radius on jobs that do not need full vault):
 *   --scope=full              default — Cloudflare, mail, Discord, Firebase, cron, GitHub token
 *   --scope=cloudflare-deploy   Cloudflare deploy credentials + account id only
 *
 * Vault blob: CRED_STORE_GPG_BASE64 (GitHub secret) or CRED_STORE_FILE (local path).
 *
 * Usage (GitHub Actions):
 *   env:
 *     CRED_VAULT_PASSPHRASE: ${{ secrets.CRED_VAULT_PASSPHRASE }}
 *     CRED_STORE_GPG_BASE64: ${{ secrets.CRED_STORE_GPG_BASE64 }}
 *   run: node scripts/load-cred-vault-env-ci.mjs [--scope=cloudflare-deploy]
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decryptCredentialVault,
  gpgDecryptLastError,
  loadCursorCloudflareSecretsFromVault,
  loadFirebaseServiceAccountFromVault,
} from "./lib/cred-vault-sync.mjs";
import { exportEnvToGithub } from "./lib/github-actions-env.mjs";
import { pickDeployAuth, setGithubActionsOutput } from "./lib/mail-credentials.mjs";

const DEFAULT_VAULT =
  process.env.CRED_STORE_FILE ?? "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";

function parseScope(argv) {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--scope" && argv[i + 1]) return argv[++i];
    if (argv[i].startsWith("--scope=")) return argv[i].slice("--scope=".length);
  }
  return "full";
}

const scope = parseScope(process.argv);

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

function exportSecret(name, value) {
  exportEnvToGithub(name, value, { sensitive: true });
}

function exportPlain(name, value) {
  exportEnvToGithub(name, value, { sensitive: false });
}

async function exportCloudflareDeploy(loaded, baseEnv) {
  if (loaded.accountId) exportPlain("CLOUDFLARE_ACCOUNT_ID", loaded.accountId);

  const env = {
    ...baseEnv,
    ...(loaded.accountId ? { CLOUDFLARE_ACCOUNT_ID: loaded.accountId } : {}),
    ...(loaded.apiToken ? { CLOUDFLARE_API_TOKEN: loaded.apiToken } : {}),
    ...(loaded.globalApiKey ? { CLOUDFLARE_API_KEY: loaded.globalApiKey } : {}),
    ...(loaded.globalApiEmail ? { CLOUDFLARE_EMAIL: loaded.globalApiEmail } : {}),
  };

  const { auth, probe } = await pickDeployAuth(env);
  if (auth.type === "bearer" && auth.token) {
    exportSecret("CLOUDFLARE_API_TOKEN", auth.token);
    setGithubActionsOutput("deploy_auth", probe.via ?? "bearer");
    console.log(`::notice::Cred vault: deploy via bearer (${probe.via ?? "probe"}).`);
  } else if (auth.type === "global") {
    exportSecret("CLOUDFLARE_API_KEY", auth.apiKey);
    exportSecret("CLOUDFLARE_EMAIL", auth.email);
    setGithubActionsOutput("deploy_auth", probe.via ?? "global-key");
    console.log(`::notice::Cred vault: deploy via Global API Key (${probe.via ?? "probe"}).`);
  } else {
    console.warn("::warning::Cred vault loaded but no working deploy credential found.");
  }
}

async function exportFullVault(loaded, baseEnv) {
  if (loaded.cronSecret) exportSecret("CRON_SECRET", loaded.cronSecret);
  if (loaded.githubToken) exportSecret("GITHUB_TOKEN", loaded.githubToken);
  if (loaded.resendApiKey) exportSecret("RESEND_API_KEY", loaded.resendApiKey);
  if (loaded.testmailApiKey) exportSecret("TESTMAIL_API_KEY", loaded.testmailApiKey);
  if (loaded.testmailNamespace) exportPlain("TESTMAIL_NAMESPACE", loaded.testmailNamespace);
  if (loaded.emailToken) exportSecret("CLOUDFLARE_EMAIL_API_TOKEN", loaded.emailToken);
  if (loaded.adminMasterEmail) {
    exportPlain("ADMIN_MASTER_EMAIL", loaded.adminMasterEmail);
    exportPlain("VITE_ADMIN_MASTER_EMAIL", loaded.adminMasterEmail);
  }
  if (loaded.mailRedirectTo) exportPlain("MAIL_REDIRECT_TO", loaded.mailRedirectTo);
  if (loaded.discordDeploymentWebhook) {
    exportSecret("DISCORD_DEPLOYMENT_WEBHOOK", loaded.discordDeploymentWebhook);
    exportSecret("DISCORD_DEPLOYMENT_WEBHOOK_URL", loaded.discordDeploymentWebhook);
  }
  if (loaded.discordCommunityWebhook) {
    exportSecret("DISCORD_COMMUNITY_WEBHOOK_URL", loaded.discordCommunityWebhook);
  }
  if (loaded.discordFeedbackWebhook) {
    exportSecret("DISCORD_FEEDBACK_WEBHOOK_URL", loaded.discordFeedbackWebhook);
  }
  if (loaded.discordGithubLogWebhook) {
    exportSecret("DISCORD_GITHUB_LOG_WEBHOOK_URL", loaded.discordGithubLogWebhook);
  }

  const firebaseSa = loadFirebaseServiceAccountFromVault();
  if (firebaseSa && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    exportSecret("FIREBASE_SERVICE_ACCOUNT_JSON", firebaseSa);
  }

  await exportCloudflareDeploy(loaded, baseEnv);
}

async function main() {
  if (!process.env.CRED_VAULT_PASSPHRASE?.trim() && !process.env.CRED_PASSPHRASE?.trim()) {
    console.log("::notice::CRED_VAULT_PASSPHRASE not set — skipping vault decrypt (using workflow secrets).");
    return;
  }

  const { vaultPath, cleanup } = materializeVaultFile();
  process.env.CRED_STORE_FILE = vaultPath;

  try {
    const vault = decryptCredentialVault();
    if (!vault) {
      const hasBlob = Boolean((process.env.CRED_STORE_GPG_BASE64 ?? "").trim());
      const gpgHint = gpgDecryptLastError() ? ` (${gpgDecryptLastError()})` : "";
      console.warn(
        hasBlob
          ? `::warning::Cred vault GPG decrypt failed (check CRED_VAULT_PASSPHRASE vs CRED_STORE_GPG_BASE64)${gpgHint} — falling back to workflow secrets.`
          : "::warning::Cred vault blob missing (CRED_STORE_GPG_BASE64) — falling back to workflow secrets."
      );
      return;
    }

    const loaded = loadCursorCloudflareSecretsFromVault();
    if (!loaded) {
      console.warn(
        "::warning::Cred vault decrypted but no Cloudflare credentials found — falling back to workflow secrets."
      );
      return;
    }

    console.log(`::notice::Cred vault loader scope=${scope}`);

    if (scope === "cloudflare-deploy") {
      await exportCloudflareDeploy(loaded, process.env);
    } else if (scope === "full") {
      await exportFullVault(loaded, process.env);
    } else {
      console.error(`::error::Unknown --scope=${scope} (use full or cloudflare-deploy)`);
      process.exit(1);
    }
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(`::error::load-cred-vault-env-ci failed: ${err.message}`);
  process.exit(1);
});
