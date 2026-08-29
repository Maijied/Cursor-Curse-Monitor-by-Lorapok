/**
 * Sync CRON_SECRET to Pages + stats-cron worker and deploy the worker.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cronDir = resolve(adminDir, "workers/stats-cron");
const PAGES_PROJECT = "cursor-monitor-admin";

/**
 * @param {string} secret
 * @param {{ deployToken: string; accountId: string }} auth
 */
export function putPagesCronSecret(secret, { deployToken, accountId }) {
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", "CRON_SECRET", `--project-name=${PAGES_PROJECT}`],
    {
      cwd: adminDir,
      input: secret,
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_API_TOKEN: deployToken,
      },
    }
  );
  if (r.status !== 0) {
    throw new Error(`Pages CRON_SECRET sync failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * @param {string} secret
 * @param {{ deployToken: string; accountId: string }} auth
 */
export function putWorkerCronSecret(secret, { deployToken, accountId }) {
  const r = spawnSync("npx", ["wrangler", "secret", "put", "CRON_SECRET"], {
    cwd: cronDir,
    input: secret,
    encoding: "utf8",
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId,
      CLOUDFLARE_API_TOKEN: deployToken,
    },
  });
  if (r.status !== 0) {
    throw new Error(`Worker CRON_SECRET sync failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * @param {{ deployToken: string; accountId: string }} auth
 */
export function deployStatsCronWorker({ deployToken, accountId }) {
  const r = spawnSync("npx", ["wrangler", "deploy"], {
    cwd: cronDir,
    encoding: "utf8",
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: accountId,
      CLOUDFLARE_API_TOKEN: deployToken,
    },
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    throw new Error(`ccm-stats-cron deploy failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * @param {string} secret
 * @param {{ deployToken: string; accountId: string }} auth
 */
export function syncStatsCronSecrets(secret, auth) {
  putPagesCronSecret(secret, auth);
  putWorkerCronSecret(secret, auth);
}
