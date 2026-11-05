#!/usr/bin/env node
/**
 * Copy a secret from step env into GITHUB_ENV with ::add-mask:: (for workflow fallbacks).
 * Skips when the target name is already set in the environment.
 *
 * Workflow secrets are often mapped to short `FB_*` names (see ci-cd.yml). Aliases are
 * checked so vault fallback works when the vault loader did not run.
 *
 *   FB_FIREBASE_SERVICE_ACCOUNT_JSON=${{ secrets.FIREBASE_SERVICE_ACCOUNT_JSON }} \
 *     node scripts/promote-secret-to-github-env.mjs FIREBASE_SERVICE_ACCOUNT_JSON
 *
 * Reads value from process.env[NAME], process.env[FB_NAME], or known aliases.
 */
import { exportEnvToGithub } from "./lib/github-actions-env.mjs";

/** @type {Record<string, string[]>} */
const ENV_ALIASES = {
  CLOUDFLARE_API_TOKEN: ["FB_API_TOKEN", "FB_CLOUDFLARE_API_TOKEN"],
  CLOUDFLARE_API_KEY: ["FB_API_KEY", "FB_CLOUDFLARE_API_KEY"],
  CLOUDFLARE_EMAIL: ["FB_EMAIL", "FB_CLOUDFLARE_EMAIL"],
  CLOUDFLARE_EMAIL_API_TOKEN: ["FB_EMAIL_API_TOKEN", "FB_CLOUDFLARE_EMAIL_API_TOKEN"],
  CLOUDFLARE_ACCOUNT_ID: ["FB_ACCOUNT_ID", "FB_CLOUDFLARE_ACCOUNT_ID"],
  CRON_SECRET: ["FB_CRON_SECRET"],
  RESEND_API_KEY: ["FB_RESEND_API_KEY"],
  DISCORD_DEPLOYMENT_WEBHOOK: ["FB_DISCORD_DEPLOYMENT_WEBHOOK"],
  FIREBASE_SERVICE_ACCOUNT_JSON: ["FB_FIREBASE_SERVICE_ACCOUNT_JSON"],
};

const name = (process.argv[2] ?? "").trim();
if (!name) {
  console.error("::error::Usage: promote-secret-to-github-env.mjs <ENV_NAME>");
  process.exit(1);
}

if (process.env[name]?.trim()) {
  process.exit(0);
}

function resolvePromoteValue(envName) {
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

const value = resolvePromoteValue(name);
if (!value) {
  process.exit(0);
}

exportEnvToGithub(name, value, { sensitive: true });

if (name === "DISCORD_DEPLOYMENT_WEBHOOK") {
  exportEnvToGithub("DISCORD_DEPLOYMENT_WEBHOOK_URL", value, { sensitive: true });
}
