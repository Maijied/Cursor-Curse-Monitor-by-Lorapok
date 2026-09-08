/**
 * Resolve Discord deployment webhook for CI notify scripts.
 * Order: DISCORD_DEPLOYMENT_WEBHOOK env → ADMIN_KV integrations:discord (Mission Control).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidDiscordWebhookUrl } from "../../website/admin/functions/api/_shared/discord-config.js";
import { resolveDeployAuth } from "../../website/admin/scripts/lib/resolve-deploy-auth.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const adminDir = resolve(repoRoot, "website/admin");
const CONFIG_KEY = "integrations:discord";
const DEFAULT_KV_NAMESPACE_ID = "8a29ab111ed0488297e12725072e9a10";

/**
 * @param {unknown} config
 * @returns {string}
 */
export function readDeploymentWebhookFromDiscordConfig(config) {
  if (!config || typeof config !== "object") return "";
  const record = /** @type {Record<string, unknown>} */ (config);
  const candidates = [record.deploymentWebhookUrl, record.webhookUrl];
  for (const value of candidates) {
    const url = String(value ?? "").trim();
    if (isValidDiscordWebhookUrl(url)) return url;
  }
  return "";
}

function readWranglerTomlNamespaceId() {
  try {
    const raw = readFileSync(resolve(adminDir, "wrangler.toml"), "utf8");
    const match = raw.match(/binding\s*=\s*"ADMIN_KV"[\s\S]*?id\s*=\s*"([^"]+)"/);
    return match?.[1] ?? DEFAULT_KV_NAMESPACE_ID;
  } catch {
    return DEFAULT_KV_NAMESPACE_ID;
  }
}

/**
 * @param {string} namespaceId
 * @param {string} deployToken
 * @param {string} accountId
 * @returns {Promise<string>}
 */
async function readDeploymentWebhookFromAdminKv(namespaceId, deployToken, accountId) {
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
    },
  );
  if (r.status !== 0 || !r.stdout.trim()) return "";
  try {
    return readDeploymentWebhookFromDiscordConfig(JSON.parse(r.stdout));
  } catch {
    return "";
  }
}

/**
 * @param {{ allowAdminKv?: boolean }} [options]
 * @returns {Promise<{ webhookUrl: string; source: "env" | "admin_kv" | null }>}
 */
export async function resolveDiscordDeploymentWebhookUrl(options = {}) {
  const fromEnv = process.env.DISCORD_DEPLOYMENT_WEBHOOK?.trim() ?? "";
  if (isValidDiscordWebhookUrl(fromEnv)) {
    return { webhookUrl: fromEnv, source: "env" };
  }

  if (options.allowAdminKv === false) {
    return { webhookUrl: "", source: null };
  }

  try {
    const { deployToken, accountId } = await resolveDeployAuth(adminDir);
    const namespaceId = readWranglerTomlNamespaceId();
    const fromKv = await readDeploymentWebhookFromAdminKv(namespaceId, deployToken, accountId);
    if (isValidDiscordWebhookUrl(fromKv)) {
      return { webhookUrl: fromKv, source: "admin_kv" };
    }
  } catch (error) {
    console.warn(
      "::warning::Discord notify: ADMIN_KV webhook lookup failed",
      error instanceof Error ? error.message : error,
    );
  }

  return { webhookUrl: "", source: null };
}
