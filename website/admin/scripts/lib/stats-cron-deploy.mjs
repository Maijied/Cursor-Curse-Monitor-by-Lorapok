/**
 * Sync CRON_SECRET to Pages + stats-cron worker and deploy the worker.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultAdminDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PAGES_PROJECT = "cursor-monitor-admin";
const WORKER_CONFIG = "workers/stats-cron/wrangler.toml";

function wranglerEnv({ deployToken, accountId }) {
  return {
    ...process.env,
    CI: "true",
    WRANGLER_SEND_METRICS: "false",
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_API_TOKEN: deployToken,
  };
}

/**
 * @param {string} secret
 * @param {{ deployToken: string; accountId: string }} auth
 * @param {{ adminDir?: string; stdio?: "inherit" | ["pipe","pipe","pipe"] }} [opts]
 */
export function putPagesCronSecret(secret, auth, opts = {}) {
  const adminDir = opts.adminDir ?? defaultAdminDir;
  const stdio = opts.stdio ?? ["pipe", "pipe", "pipe"];
  console.log("  → wrangler pages secret put CRON_SECRET …");
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", "CRON_SECRET", `--project-name=${PAGES_PROJECT}`],
    {
      cwd: adminDir,
      input: secret,
      encoding: "utf8",
      stdio: stdio === "inherit" ? ["pipe", "inherit", "inherit"] : stdio,
      env: wranglerEnv(auth),
    }
  );
  if (r.status !== 0) {
    const detail = [r.stderr, r.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      detail
        ? `Pages CRON_SECRET sync failed:\n${detail}`
        : "Pages CRON_SECRET sync failed (wrangler exited non-zero — check token or run: cd website/admin && npx wrangler login)"
    );
  }
}

/**
 * @param {string} secret
 * @param {{ deployToken: string; accountId: string }} auth
 * @param {{ adminDir?: string; stdio?: "inherit" | ["pipe","pipe","pipe"] }} [opts]
 */
export function putWorkerCronSecret(secret, auth, opts = {}) {
  const adminDir = opts.adminDir ?? defaultAdminDir;
  const stdio = opts.stdio ?? ["pipe", "pipe", "pipe"];
  console.log("  → wrangler secret put CRON_SECRET (ccm-stats-cron) …");
  const r = spawnSync(
    "npx",
    ["wrangler", "secret", "put", "CRON_SECRET", "--config", WORKER_CONFIG],
    {
      cwd: adminDir,
      input: secret,
      encoding: "utf8",
      stdio: stdio === "inherit" ? ["pipe", "inherit", "inherit"] : stdio,
      env: wranglerEnv(auth),
    }
  );
  if (r.status !== 0) {
    const detail = [r.stderr, r.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      detail
        ? `Worker CRON_SECRET sync failed:\n${detail}`
        : "Worker CRON_SECRET sync failed (wrangler exited non-zero)"
    );
  }
}

/**
 * @param {{ deployToken: string; accountId: string }} auth
 * @param {{ adminDir?: string; stdio?: "inherit" }} [opts]
 */
export function deployStatsCronWorker(auth, opts = {}) {
  const adminDir = opts.adminDir ?? defaultAdminDir;
  const stdio = opts.stdio ?? "inherit";
  console.log("  → wrangler deploy ccm-stats-cron …");
  const r = spawnSync("npx", ["wrangler", "deploy", "--config", WORKER_CONFIG], {
    cwd: adminDir,
    encoding: "utf8",
    stdio: stdio === "inherit" ? "inherit" : stdio,
    env: wranglerEnv(auth),
  });
  if (r.status !== 0) {
    throw new Error(`ccm-stats-cron deploy failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * @param {string} secret
 * @param {{ deployToken: string; accountId: string }} auth
 * @param {{ adminDir?: string; stdio?: "inherit" }} [opts]
 */
export function syncStatsCronSecrets(secret, auth, opts = {}) {
  putPagesCronSecret(secret, auth, opts);
  putWorkerCronSecret(secret, auth, opts);
}
