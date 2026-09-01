#!/usr/bin/env node
/**
 * Sync Discord webhook URLs from cred vault → ADMIN_KV `integrations:discord`.
 *
 * Vault keys (cursor namespace — store with `cred set cursor <key>`):
 *   discord_community_webhook_url   — community announcements channel
 *   discord_feedback_webhook_url    — optional; in-app feedback prompts
 *   discord_deployment_webhook_url  — optional; CI deployment status
 *
 * Env overrides (no logging of values):
 *   DISCORD_COMMUNITY_WEBHOOK_URL
 *   DISCORD_FEEDBACK_WEBHOOK_URL
 *   DISCORD_DEPLOYMENT_WEBHOOK_URL
 *
 * Flags:
 *   --dry-run   Print planned KV merge without writing
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidDiscordWebhookUrl } from "../website/admin/functions/api/_shared/discord-config.js";
import { resolveDeployAuth } from "../website/admin/scripts/lib/resolve-deploy-auth.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminDir = resolve(repoRoot, "website/admin");
const CONFIG_KEY = "integrations:discord";
const KV_NAMESPACE_ID = "8a29ab111ed0488297e12725072e9a10";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

/** @typedef {{ deploymentWebhookUrl?: string; feedbackWebhookUrl?: string; communityWebhookUrl?: string; updatedAt?: string | null; updatedBy?: string | null; webhookUrl?: string }} DiscordKvConfig */

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
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (r.status !== 0) return "";
  return r.stdout.trim();
}

function resolveWebhook(envName, vaultKey) {
  const fromEnv = (process.env[envName] ?? "").trim();
  if (fromEnv) return fromEnv;
  const fromCred = credGet(vaultKey);
  if (fromCred) return fromCred;
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
  const r = spawnSync(
    "npx",
    ["wrangler", "kv", "key", "put", CONFIG_KEY, JSON.stringify(value), "--namespace-id", namespaceId, "--remote"],
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
}

/**
 * @param {DiscordKvConfig} current
 * @param {{ community?: string; feedback?: string; deployment?: string }} incoming
 */
function mergeDiscordConfig(current, incoming) {
  /** @type {DiscordKvConfig} */
  const next = {
    deploymentWebhookUrl: String(current.deploymentWebhookUrl ?? current.webhookUrl ?? ""),
    feedbackWebhookUrl: String(current.feedbackWebhookUrl ?? ""),
    communityWebhookUrl: String(current.communityWebhookUrl ?? ""),
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

  if (changed) {
    next.updatedAt = new Date().toISOString();
    next.updatedBy = "sync-discord-cred-vault";
  }

  return { next, changed };
}

async function main() {
  log("1/3", "Resolving webhook URLs from env / cred vault (secrets never logged)…");
  const community = resolveWebhook("DISCORD_COMMUNITY_WEBHOOK_URL", "discord_community_webhook_url");
  const feedback = resolveWebhook("DISCORD_FEEDBACK_WEBHOOK_URL", "discord_feedback_webhook_url");
  const deployment = resolveWebhook("DISCORD_DEPLOYMENT_WEBHOOK_URL", "discord_deployment_webhook_url");

  if (!community && !feedback && !deployment) {
    console.error(
      "\nNo Discord webhook URLs found.\n" +
        "  cred set cursor discord_community_webhook_url\n" +
        "  — or —\n" +
        '  export DISCORD_COMMUNITY_WEBHOOK_URL="$(cred get cursor discord_community_webhook_url)"'
    );
    process.exit(1);
  }

  const configured = [
    community ? "community" : null,
    feedback ? "feedback" : null,
    deployment ? "deployment" : null,
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
