#!/usr/bin/env node
/**
 * CI: sync CRON_SECRET to Pages + ccm-stats-cron worker, then deploy worker.
 * Secret source: GitHub admin-production CRON_SECRET (sync via sync-stats-cron-cred-vault.mjs).
 */
import { resolveMailCredentials } from "./lib/mail-credentials.mjs";
import {
  deployStatsCronWorker,
  syncStatsCronSecrets,
} from "./lib/stats-cron-deploy.mjs";

const { accountId, deployToken } = resolveMailCredentials();
const cronSecret = (process.env.CRON_SECRET ?? "").trim();

if (!accountId || !deployToken) {
  console.error("::error::CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");
  process.exit(1);
}

if (!cronSecret) {
  console.warn(
    "::warning::CRON_SECRET not set — skipping stats cron deploy. " +
      "Run: node website/admin/scripts/sync-stats-cron-cred-vault.mjs (after cred set cursor cron_secret)"
  );
  process.exit(0);
}

try {
  syncStatsCronSecrets(cronSecret, { deployToken, accountId });
  console.log("::notice::CRON_SECRET synced to Pages + ccm-stats-cron worker");
  deployStatsCronWorker({ deployToken, accountId });
  console.log("::notice::ccm-stats-cron worker deployed");
} catch (err) {
  console.error(`::error::Stats cron deploy failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
