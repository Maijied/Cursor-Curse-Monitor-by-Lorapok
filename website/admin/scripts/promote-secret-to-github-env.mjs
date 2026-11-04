#!/usr/bin/env node
/**
 * Copy a secret from step env into GITHUB_ENV with ::add-mask:: (for workflow fallbacks).
 * Skips when the target name is already set in the environment.
 *
 *   FB_FIREBASE_SERVICE_ACCOUNT_JSON=${{ secrets.FIREBASE_SERVICE_ACCOUNT_JSON }} \
 *     node scripts/promote-secret-to-github-env.mjs FIREBASE_SERVICE_ACCOUNT_JSON
 *
 * Reads value from process.env[NAME] or process.env[FB_NAME].
 */
import { exportEnvToGithub } from "./lib/github-actions-env.mjs";

const name = (process.argv[2] ?? "").trim();
if (!name) {
  console.error("::error::Usage: promote-secret-to-github-env.mjs <ENV_NAME>");
  process.exit(1);
}

if (process.env[name]?.trim()) {
  process.exit(0);
}

const fbKey = name.startsWith("FB_") ? name : `FB_${name}`;
const value = (process.env[name] ?? process.env[fbKey] ?? "").trim();
if (!value) {
  process.exit(0);
}

exportEnvToGithub(name, value, { sensitive: true });
