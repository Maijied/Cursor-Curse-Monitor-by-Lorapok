#!/usr/bin/env node
/**
 * CI: sync CRON_SECRET to Pages + ccm-stats-cron worker, then deploy worker.
 * Secret source: cred vault or GitHub admin-production CRON_SECRET.
 */
import { pickDeployAuth, resolveMailCredentials, wranglerDeployEnv } from "./lib/mail-credentials.mjs";
import {
  deployStatsCronWorker,
  syncStatsCronSecrets,
} from "./lib/stats-cron-deploy.mjs";

const { accountId } = resolveMailCredentials();
const cronSecret = (process.env.CRON_SECRET ?? "").trim();
const { auth, probe } = await pickDeployAuth();

const hasDeploy =
  (auth.type === "bearer" && auth.token) || (auth.type === "global" && auth.apiKey && auth.email);

if (!accountId || !hasDeploy) {
  console.error(
    "::error::CLOUDFLARE_ACCOUNT_ID and deploy credentials (API token or Global API Key + email) are required."
  );
  process.exit(1);
}

if (!cronSecret) {
  console.warn(
    "::warning::CRON_SECRET not set — skipping stats cron deploy. " +
      "Run: node website/admin/scripts/sync-stats-cron-cred-vault.mjs (after cred set cursor cron_secret)"
  );
  process.exit(0);
}

const wranglerEnv = wranglerDeployEnv(accountId, auth, process.env);
const deployAuth = { accountId, deployAuth: auth, wranglerEnv };

try {
  syncStatsCronSecrets(cronSecret, deployAuth);
  console.log(`::notice::CRON_SECRET synced to Pages + ccm-stats-cron worker (${probe.via ?? "auth"})`);
  deployStatsCronWorker(deployAuth);
  console.log("::notice::ccm-stats-cron worker deployed");
} catch (err) {
  console.error(`::error::Stats cron deploy failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
