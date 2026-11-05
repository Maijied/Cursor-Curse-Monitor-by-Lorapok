#!/usr/bin/env node
/**
 * Copy a non-secret env var into GITHUB_ENV (no masking). For workflow fallbacks only.
 *
 *   FB_ACCOUNT_ID=${{ secrets.CLOUDFLARE_ACCOUNT_ID }} \
 *     node scripts/promote-plain-to-github-env.mjs CLOUDFLARE_ACCOUNT_ID
 */
import { exportEnvToGithub } from "./lib/github-actions-env.mjs";

const ENV_ALIASES = {
  CLOUDFLARE_ACCOUNT_ID: ["FB_ACCOUNT_ID", "FB_CLOUDFLARE_ACCOUNT_ID"],
  ADMIN_MASTER_EMAIL: ["FB_ADMIN_MASTER_EMAIL"],
};

const name = (process.argv[2] ?? "").trim();
if (!name) {
  console.error("::error::Usage: promote-plain-to-github-env.mjs <ENV_NAME>");
  process.exit(1);
}

if (process.env[name]?.trim()) {
  process.exit(0);
}

function resolveValue(envName) {
  const direct = String(process.env[envName] ?? "").trim();
  if (direct) return direct;
  const fbKey = envName.startsWith("FB_") ? envName : `FB_${envName}`;
  const fromFb = String(process.env[fbKey] ?? "").trim();
  if (fromFb) return fromFb;
  for (const alias of ENV_ALIASES[envName] ?? []) {
    const fromAlias = String(process.env[alias] ?? "").trim();
    if (fromAlias) return fromAlias;
  }
  return "";
}

const value = resolveValue(name);
if (!value) {
  process.exit(0);
}

exportEnvToGithub(name, value, { sensitive: false });

if (name === "ADMIN_MASTER_EMAIL") {
  exportEnvToGithub("VITE_ADMIN_MASTER_EMAIL", value, { sensitive: false });
}
