#!/usr/bin/env node
/**
 * Sync Discord webhook URLs from cred vault → ADMIN_KV `integrations:discord`.
 *
 * Vault keys (cursor namespace — store with `cred set cursor <key>`):
 *   discord_community_webhook_url    — community announcements channel
 *   discord_feedback_webhook_url     — optional; in-app feedback prompts
 *   discord_deployment_webhook_url   — optional; CI deployment status cards
 *   discord_github_log_webhook_url   — GitHub ingest (push/release/completed workflows)
 *
 * Env overrides (no logging of values):
 *   DISCORD_COMMUNITY_WEBHOOK_URL
 *   DISCORD_FEEDBACK_WEBHOOK_URL
 *   DISCORD_DEPLOYMENT_WEBHOOK_URL
 *   DISCORD_GITHUB_LOG_WEBHOOK_URL
 *
 * CI: prefers env (from load-cred-vault-env-ci) then decrypts CRED_STORE_GPG_BASE64.
 * Local: env → GPG vault → `cred get`.
 *
 * Flags:
 *   --dry-run   Print planned KV merge without writing
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { isValidDiscordWebhookUrl } from "../website/admin/functions/api/_shared/discord-config.js";
import { resolveDeployAuth } from "../website/admin/scripts/lib/resolve-deploy-auth.mjs";
import {
  decryptCredentialVault,
  resolveDiscordWebhooksFromVault,
} from "../website/admin/scripts/lib/cred-vault-sync.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminDir = resolve(repoRoot, "website/admin");
const CONFIG_KEY = "integrations:discord";
const KV_NAMESPACE_ID = "8a29ab111ed0488297e12725072e9a10";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

/** @typedef {{ deploymentWebhookUrl?: string; feedbackWebhookUrl?: string; communityWebhookUrl?: string; githubLogWebhookUrl?: string; communityInviteUrl?: string; updatedAt?: string | null; updatedBy?: string | null; webhookUrl?: string }} DiscordKvConfig */

function log(step, message) {
  console.log(`\n[discord sync] ${step} ${message}`);
}

function readWranglerTomlNamespaceId() {
  try {
    const raw = readFileSync(resolve(adminDir, "wrangler.toml"), "utf8");
    const match = raw.match(/binding\s*=\s*"ADMIN_KV"[\s\S]*?id\s*=\s*"([^"]+)"/);
    return match?.[1] ?? KV_NAMESPACE_ID;
  } catch {
    return KV_NAMESPACE_ID;
  }
}

function credGet(key) {
  const r = spawnSync("cred", ["get", "cursor", key], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (r.status !== 0) return "";
  return (r.stdout ?? "").trim();
}

/**
 * Decrypt vault for CI (CRED_STORE_GPG_BASE64) or local path.
 * @returns {Record<string, unknown> | null}
 */
function loadVaultForSync() {
  const b64 = (process.env.CRED_STORE_GPG_BASE64 ?? "").trim();
  if (b64) {
    const dir = mkdtempSync(join(tmpdir(), "discord-vault-"));
    const vaultPath = join(dir, "credentials.json.gpg");
    try {
      writeFileSync(vaultPath, Buffer.from(b64, "base64"));
      process.env.CRED_STORE_FILE = vaultPath;
      return decryptCredentialVault(vaultPath);
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
  return decryptCredentialVault();
}

/**
 * @param {string} envName
 * @param {keyof ReturnType<typeof resolveDiscordWebhooksFromVault>} vaultSlot
 * @param {string} vaultKey
 * @param {ReturnType<typeof resolveDiscordWebhooksFromVault> | null} fromVault
 */
function resolveWebhook(envName, vaultSlot, vaultKey, fromVault) {
  const fromEnv = (process.env[envName] ?? "").trim();
  if (fromEnv && isValidDiscordWebhookUrl(fromEnv)) return fromEnv;
  const vaultUrl = fromVault?.[vaultSlot] ? String(fromVault[vaultSlot]).trim() : "";
  if (vaultUrl && isValidDiscordWebhookUrl(vaultUrl)) return vaultUrl;
  const fromCred = credGet(vaultKey);
  if (fromCred && isValidDiscordWebhookUrl(fromCred)) return fromCred;
  return "";
}

async function wranglerKvGet(namespaceId, deployToken, accountId) {
  const r = spawnSync(
    "npx",
    ["wrangler", "kv", "key", "get", CONFIG_KEY, "--namespace-id", namespaceId, "--remote"],
    {
      cwd: adminDir,
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: deployToken,
        CLOUDFLARE_ACCOUNT_ID: accountId,
      },
    }
  );
  if (r.status !== 0 || !r.stdout.trim()) return {};
  try {
    return JSON.parse(r.stdout);
  } catch {
    return {};
  }
}

function wranglerKvPut(namespaceId, deployToken, accountId, value) {
  const tmp = join(tmpdir(), `discord-kv-sync-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  try {
    const r = spawnSync(
      "npx",
      ["wrangler", "kv", "key", "put", CONFIG_KEY, "--namespace-id", namespaceId, "--remote", "--path", tmp],
      {
        cwd: adminDir,
        encoding: "utf8",
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: deployToken,
          CLOUDFLARE_ACCOUNT_ID: accountId,
        },
      }
    );
    if (r.status !== 0) {
      throw new Error(r.stderr?.trim() || "wrangler kv key put failed");
    }
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {DiscordKvConfig} current
 * @param {{ community?: string; feedback?: string; deployment?: string; githubLog?: string }} incoming
 */
export function mergeDiscordConfig(current, incoming) {
  /** @type {DiscordKvConfig} */
  const next = {
    deploymentWebhookUrl: String(current.deploymentWebhookUrl ?? current.webhookUrl ?? ""),
    feedbackWebhookUrl: String(current.feedbackWebhookUrl ?? ""),
    communityWebhookUrl: String(current.communityWebhookUrl ?? ""),
    githubLogWebhookUrl: String(current.githubLogWebhookUrl ?? ""),
    communityInviteUrl: current.communityInviteUrl,
    updatedAt: current.updatedAt ?? null,
    updatedBy: current.updatedBy ?? null,
  };

  let changed = false;

  if (incoming.community && isValidDiscordWebhookUrl(incoming.community)) {
    if (next.communityWebhookUrl !== incoming.community) changed = true;
    next.communityWebhookUrl = incoming.community;
  }
  if (incoming.feedback && isValidDiscordWebhookUrl(incoming.feedback)) {
    if (next.feedbackWebhookUrl !== incoming.feedback) changed = true;
    next.feedbackWebhookUrl = incoming.feedback;
  }
  if (incoming.deployment && isValidDiscordWebhookUrl(incoming.deployment)) {
    if (next.deploymentWebhookUrl !== incoming.deployment) changed = true;
    next.deploymentWebhookUrl = incoming.deployment;
  }
  if (incoming.githubLog && isValidDiscordWebhookUrl(incoming.githubLog)) {
    if (next.githubLogWebhookUrl !== incoming.githubLog) changed = true;
    next.githubLogWebhookUrl = incoming.githubLog;
  }

  if (changed) {
    next.updatedAt = new Date().toISOString();
    next.updatedBy = "sync-discord-cred-vault";
  }

  return { next, changed };
}

async function main() {
  log("1/3", "Resolving webhook URLs from env / cred vault (secrets never logged)…");

  const vault = loadVaultForSync();
  const fromVault = vault ? resolveDiscordWebhooksFromVault(vault) : null;
  if (vault) {
    console.log("  vault: decrypted");
  } else if ((process.env.CRED_STORE_GPG_BASE64 ?? "").trim()) {
    console.log("  vault: decrypt failed (check CRED_VAULT_PASSPHRASE)");
  } else {
    console.log("  vault: not available (using env / cred CLI)");
  }

  const community = resolveWebhook(
    "DISCORD_COMMUNITY_WEBHOOK_URL",
    "community",
    "discord_community_webhook_url",
    fromVault
  );
  const feedback = resolveWebhook(
    "DISCORD_FEEDBACK_WEBHOOK_URL",
    "feedback",
    "discord_feedback_webhook_url",
    fromVault
  );
  const deployment =
    resolveWebhook(
      "DISCORD_DEPLOYMENT_WEBHOOK_URL",
      "deployment",
      "discord_deployment_webhook_url",
      fromVault
    ) ||
    resolveWebhook(
      "DISCORD_DEPLOYMENT_WEBHOOK",
      "deployment",
      "discord_deployment_webhook_url",
      fromVault
    );
  const githubLog = resolveWebhook(
    "DISCORD_GITHUB_LOG_WEBHOOK_URL",
    "githubLog",
    "discord_github_log_webhook_url",
    fromVault
  );

  if (!community && !feedback && !deployment && !githubLog) {
    const msg =
      "No Discord webhook URLs found (env / vault / cred). " +
      "Ensure load-cred-vault-env-ci ran or CRED_STORE_GPG_BASE64 is set.";
    if (process.env.GITHUB_ACTIONS === "true") {
      console.log(`::warning::${msg}`);
      process.exit(0);
    }
    console.error(`\n${msg}\n  cred set cursor discord_community_webhook_url`);
    process.exit(1);
  }

  const configured = [
    community ? "community" : null,
    feedback ? "feedback" : null,
    deployment ? "deployment" : null,
    githubLog ? "github-log" : null,
  ].filter(Boolean);
  console.log(`  sources ready: ${configured.join(", ")}`);

  log("2/3", "Reading current ADMIN_KV discord config…");
  const namespaceId = readWranglerTomlNamespaceId();
  const { deployToken, accountId, via } = await resolveDeployAuth(adminDir);
  console.log(`  auth: ${via}`);
  const current = await wranglerKvGet(namespaceId, deployToken, accountId);
  const { next, changed } = mergeDiscordConfig(current, {
    community,
    feedback,
    deployment,
    githubLog,
  });

  if (!changed) {
    console.log("\nNo changes — ADMIN_KV already matches vault/env values.");
    return;
  }

  log("3/3", dryRun ? "[dry-run] would write integrations:discord to ADMIN_KV" : "Writing integrations:discord to ADMIN_KV…");
  if (dryRun) {
    console.log(
      JSON.stringify({
        keys: {
          communityConfigured: Boolean(next.communityWebhookUrl),
          feedbackConfigured: Boolean(next.feedbackWebhookUrl),
          deploymentConfigured: Boolean(next.deploymentWebhookUrl),
          githubLogConfigured: Boolean(next.githubLogWebhookUrl),
        },
      })
    );
    return;
  }

  wranglerKvPut(namespaceId, deployToken, accountId, next);
  console.log("✓ ADMIN_KV integrations:discord updated");
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
