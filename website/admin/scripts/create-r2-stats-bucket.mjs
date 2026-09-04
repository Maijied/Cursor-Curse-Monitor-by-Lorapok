#!/usr/bin/env node
/**
 * Create STATS_R2 bucket for Mission Control stats artifacts.
 *
 * Prerequisite: enable R2 in Cloudflare dashboard (Account → R2 → Enable).
 *
 * Usage:
 *   node website/admin/scripts/create-r2-stats-bucket.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { envWithCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";
import { pickDeployToken, tryWranglerOAuthToken } from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "ccm-admin-stats";

async function resolveToken() {
  const picked = await pickDeployToken(envWithCursorCloudflareSecrets(process.env));
  if (picked.probe.ok) return picked.token;
  const oauth = tryWranglerOAuthToken(adminDir);
  if (oauth) return oauth;
  throw new Error("No Cloudflare deploy auth — update cred vault or wrangler login");
}

const token = await resolveToken();
const env = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: token,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a",
};

const create = spawnSync("npx", ["wrangler", "r2", "bucket", "create", BUCKET], {
  cwd: adminDir,
  encoding: "utf8",
  env,
});
if (create.status !== 0) {
  const out = `${create.stderr}\n${create.stdout}`.trim();
  if (/already exists|10004/i.test(out)) {
    console.log(`R2 bucket ${BUCKET} already exists.`);
    process.exit(0);
  }
  console.error(out || "wrangler r2 bucket create failed");
  if (/enable R2|10042/i.test(out)) {
    console.error("\nEnable R2 in Cloudflare dashboard first, then re-run this script.");
  }
  process.exit(create.status ?? 1);
}

console.log(`Created R2 bucket ${BUCKET}. Deploy admin to bind STATS_R2.`);
