#!/usr/bin/env node
/**
 * Retry failed outbound mailbox messages in production (or local dev API).
 *
 *   node website/admin/scripts/retry-failed-mail.mjs
 *   node website/admin/scripts/retry-failed-mail.mjs --api https://cursor-dev.lorapok.tech --limit 25
 */
import { loadCursorCloudflareSecretsFromVault } from "./lib/cred-vault-sync.mjs";

function parseArgs(argv) {
  /** @type {{ api?: string; limit?: number; includeRetried?: boolean; token?: string; cronSecret?: string }} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--include-retried") out.includeRetried = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--api" && argv[i + 1]) out.api = argv[++i];
    else if (arg.startsWith("--api=")) out.api = arg.slice("--api=".length);
    else if (arg === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.slice("--limit=".length));
    else if (arg === "--token" && argv[i + 1]) out.token = argv[++i];
    else if (arg.startsWith("--token=")) out.token = arg.slice("--token=".length);
    else if (arg === "--cron-secret" && argv[i + 1]) out.cronSecret = argv[++i];
    else if (arg.startsWith("--cron-secret=")) out.cronSecret = arg.slice("--cron-secret=".length);
  }
  return out;
}

function usage() {
  console.log(
    "Usage: retry-failed-mail.mjs [--api URL] [--limit N] [--include-retried]\n" +
      "  Auth: ADMIN_ID_TOKEN (mailbox action) or CRON_SECRET / cred vault cron_secret (cron route)"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const apiBase = (args.api ?? process.env.ADMIN_API_BASE ?? "https://cursor-dev.lorapok.tech").replace(/\/$/, "");
  const limit = Number.isFinite(args.limit) ? args.limit : 50;

  let cronSecret = args.cronSecret ?? process.env.CRON_SECRET ?? "";
  if (!cronSecret && process.env.CCM_SKIP_CRED_VAULT !== "1") {
    try {
      const vault = await loadCursorCloudflareSecretsFromVault();
      cronSecret = vault.cronSecret ?? vault.CRON_SECRET ?? "";
    } catch {
      // optional
    }
  }

  const token = args.token ?? process.env.ADMIN_ID_TOKEN ?? "";
  const body = JSON.stringify({
    action: "retry-failed",
    limit,
    includeRetried: args.includeRetried === true,
  });

  let res;
  if (token) {
    res = await fetch(`${apiBase}/api/mailbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });
  } else if (cronSecret) {
    res = await fetch(`${apiBase}/api/cron/retry-failed-mail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cron-Secret": cronSecret,
      },
      body: JSON.stringify({ limit, includeRetried: args.includeRetried === true }),
    });
  } else {
    console.error("Missing auth. Set ADMIN_ID_TOKEN or ensure cred vault has cron_secret.");
    process.exit(1);
  }

  const data = await res.json().catch(() => ({}));
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok) process.exit(1);
  if (data.failed > 0) process.exit(2);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
