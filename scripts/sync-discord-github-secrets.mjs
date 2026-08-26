#!/usr/bin/env node
/**
 * Sync Discord deployment credentials from secure cred vault to GitHub + Cloudflare.
 *
 * Vault entry `565087` (override with DISCORD_VAULT_ID):
 *   - webhook_url       → Mission Control KV `integrations:discord`
 *   - deploy_notify_secret → GitHub + Pages secret DEPLOY_NOTIFY_SECRET
 *
 * Requires: gpg (or `cred` CLI), gh, wrangler. Set CRED_PASSPHRASE in env.
 * Never prints secret values.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = process.env.GITHUB_REPO || "Maijied/Cursor-Curse-Monitor-by-Lorapok";
const VAULT_ID = process.env.DISCORD_VAULT_ID || "565087";
const STORE_FILE =
  process.env.CRED_STORE_FILE || "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";
const ADMIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../website/admin");
const KV_NAMESPACE_ID = "8a29ab111ed0488297e12725072e9a10";
const KV_KEY = "integrations:discord";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "f049faaf2f67549f5c58837479596a4a";

function loadVault() {
  const pass = process.env.CRED_PASSPHRASE;
  if (!pass) return null;
  try {
    const json = execFileSync(
      "gpg",
      [
        "--batch",
        "--quiet",
        "--yes",
        "--pinentry-mode",
        "loopback",
        "--passphrase-fd",
        "0",
        "-d",
        STORE_FILE,
      ],
      { encoding: "utf8", input: `${pass}\n` }
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readVaultEntry(vault, key) {
  if (!vault) return "";
  const bucket = vault[VAULT_ID] ?? vault.discord ?? {};
  return String(bucket[key] ?? "").trim();
}

function credGet(key) {
  const envMap = {
    webhook_url: process.env.DISCORD_WEBHOOK_URL,
    deploy_notify_secret: process.env.DEPLOY_NOTIFY_SECRET,
  };
  if (envMap[key]) return String(envMap[key]).trim();

  const vault = loadVault();
  const fromVault = readVaultEntry(vault, key);
  if (fromVault) return fromVault;

  try {
    return execFileSync("cred", ["get", VAULT_ID, key], {
      encoding: "utf8",
      env: process.env,
    }).trim();
  } catch {
    try {
      return execFileSync("cred", ["get", "discord", key], {
        encoding: "utf8",
        env: process.env,
      }).trim();
    } catch {
      return "";
    }
  }
}

function ghSecretSet(name, value) {
  execFileSync("gh", ["secret", "set", name, "--repo", REPO, "--body", value], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log(`GitHub secret ${name} updated`);
}

function pagesSecretPut(name, value) {
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", name, "--project-name=cursor-monitor-admin"],
    {
      cwd: ADMIN_DIR,
      input: value,
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
      encoding: "utf8",
    }
  );
  if (r.status !== 0) {
    throw new Error(`wrangler pages secret put ${name} failed: ${r.stderr}`);
  }
  console.log(`Pages secret ${name} synced`);
}

function putDiscordKvConfig(webhookUrl) {
  let existing = {
    enabled: true,
    webhookUrl: "",
    events: { started: true, completed: true, failed: true, pushed: true },
    updatedAt: null,
    updatedBy: "sync-discord-github-secrets.mjs",
  };

  try {
    const read = spawnSync(
      "npx",
      ["wrangler", "kv", "key", "get", KV_KEY, "--namespace-id", KV_NAMESPACE_ID],
      { cwd: ADMIN_DIR, encoding: "utf8", env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID } }
    );
    if (read.status === 0 && read.stdout.trim()) {
      existing = { ...existing, ...JSON.parse(read.stdout) };
    }
  } catch {
    // fresh config
  }

  const next = {
    ...existing,
    enabled: true,
    webhookUrl,
    events: { started: true, completed: true, failed: true, pushed: true, ...(existing.events ?? {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: "sync-discord-github-secrets.mjs",
  };

  const r = spawnSync(
    "npx",
    ["wrangler", "kv", "key", "put", KV_KEY, JSON.stringify(next), "--namespace-id", KV_NAMESPACE_ID],
    { cwd: ADMIN_DIR, encoding: "utf8", env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID } }
  );
  if (r.status !== 0) {
    throw new Error(`wrangler kv key put failed: ${r.stderr}`);
  }
  console.log(`KV ${KV_KEY} updated (webhook configured, enabled)`);
}

const webhookUrl = credGet("webhook_url");
const notifySecret = credGet("deploy_notify_secret");

if (!webhookUrl || !notifySecret) {
  console.error(
    `::error::Discord credentials missing in vault ${VAULT_ID} (webhook_url, deploy_notify_secret)`
  );
  process.exit(1);
}

if (!/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(webhookUrl)) {
  console.error("::error::vault webhook_url is not a valid Discord webhook URL");
  process.exit(1);
}

ghSecretSet("DEPLOY_NOTIFY_SECRET", notifySecret);
pagesSecretPut("DEPLOY_NOTIFY_SECRET", notifySecret);
putDiscordKvConfig(webhookUrl);
console.log("Discord deployment secrets synced (values not logged)");
