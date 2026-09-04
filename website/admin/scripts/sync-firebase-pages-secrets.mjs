#!/usr/bin/env node
/**
 * Sync VITE_FIREBASE_* from env (or website/admin/.env) → Cloudflare Pages secrets.
 * Runtime fallback when ADMIN_KV read fails (e.g. daily get quota).
 *
 * Usage:
 *   cd website/admin && set -a && . ./.env && set +a && node scripts/sync-firebase-pages-secrets.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { envWithCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";
import { pickDeployToken, probeDeployToken, tryWranglerOAuthToken } from "./lib/mail-credentials.mjs";

const rootDir = dirname(fileURLToPath(import.meta.url));
const adminDir = resolve(rootDir, "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const PROJECT = "cursor-monitor-admin";

const SECRET_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MEASUREMENT_ID",
];

function loadDotEnv() {
  const path = join(adminDir, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

/**
 * @param {string} name
 * @param {string} value
 * @param {string} deployToken
 */
function pagesSecretPut(name, value, deployToken) {
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: deployToken };
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", name, `--project-name=${PROJECT}`],
    { cwd: adminDir, input: value, env, encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(`pages secret put ${name} failed: ${(r.stderr || r.stdout || "").trim()}`);
  }
}

async function resolveDeployToken() {
  const oauth = tryWranglerOAuthToken(adminDir);
  if (oauth) {
    const probe = await probeDeployToken(oauth, accountId);
    if (probe.ok) return { token: oauth, via: "wrangler-oauth" };
  }
  const picked = await pickDeployToken(envWithCursorCloudflareSecrets(process.env));
  if (picked.probe.ok) return { token: picked.token, via: picked.probe.via ?? "vault" };
  if (oauth) return { token: oauth, via: "wrangler-oauth-fallback" };
  const fallback = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (fallback) return { token: fallback, via: "env" };
  return null;
}

loadDotEnv();

const missing = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID"].filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(`Missing required env: ${missing.join(", ")}`);
  console.error("Load website/admin/.env or export VITE_FIREBASE_* then re-run.");
  process.exit(1);
}

const deploy = await resolveDeployToken();
if (!deploy?.token) {
  console.error("Need Cloudflare deploy auth: cd website/admin && npx wrangler login");
  process.exit(1);
}
console.log(JSON.stringify({ cloudflareDeployAuth: deploy.via }));

const synced = [];
for (const key of SECRET_KEYS) {
  const value = process.env[key]?.trim();
  if (!value) continue;
  pagesSecretPut(key, value, deploy.token);
  synced.push(key);
}

console.log(`Pages secrets synced (${synced.length}): ${synced.join(", ")}`);
