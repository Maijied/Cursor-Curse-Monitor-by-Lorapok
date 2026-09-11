#!/usr/bin/env node
/**
 * Automate Settings → GitHub webhook secret save + GitHub repo webhook registration.
 *
 * Auth (pick one):
 *   ADMIN_ID_TOKEN=<firebase-jwt>
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=...
 *
 * Usage:
 *   npm run github:webhook:bootstrap --prefix website/admin
 *   node website/admin/scripts/bootstrap-github-webhook.mjs --probe
 *   GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32) node website/admin/scripts/bootstrap-github-webhook.mjs --secret-from-env
 */
import { createHmac } from "node:crypto";
import { resolveAdminIdToken } from "./lib/admin-api-auth.mjs";
import {
  DEFAULT_GITHUB_WEBHOOK_EVENTS,
  ensureGithubRepoWebhook,
  generateWebhookSecret,
  saveGithubWebhookConfig,
} from "./lib/github-webhook-bootstrap.mjs";

const DEFAULT_URL = process.env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech";
const DEFAULT_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";

/** @param {string[]} argv */
function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    repo: DEFAULT_REPO,
    probe: false,
    secretFromEnv: false,
    skipGh: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url" && argv[i + 1]) args.url = argv[++i].replace(/\/$/, "");
    else if (arg === "--repo" && argv[i + 1]) args.repo = argv[++i];
    else if (arg === "--secret" && argv[i + 1]) args.secret = argv[++i];
    else if (arg === "--secret-from-env") args.secretFromEnv = true;
    else if (arg === "--probe") args.probe = true;
    else if (arg === "--skip-gh") args.skipGh = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage: bootstrap-github-webhook.mjs [options]

Options:
  --url <admin-url>     Mission Control base URL (default: ${DEFAULT_URL})
  --repo <owner/name>   GitHub repository (default: ${DEFAULT_REPO})
  --secret <hex>        Use this webhook secret (otherwise generates one)
  --secret-from-env     Use GITHUB_WEBHOOK_SECRET from environment
  --skip-gh             Save Mission Control config only (no gh repo hook)
  --probe               Fire a signed test delivery after bootstrap

Auth env:
  ADMIN_ID_TOKEN        Firebase ID token
  ADMIN_EMAIL           Mission Control login email
  ADMIN_PASSWORD        Mission Control login password
`);
}

async function signBody(secret, body) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

async function probeWebhook(adminUrl, secret) {
  const body = JSON.stringify({
    ref: "refs/heads/main",
    repository: { full_name: DEFAULT_REPO },
    pusher: { name: "mission-control-bootstrap" },
  });
  const signature = await signBody(secret, body);
  const endpoint = `${adminUrl.replace(/\/$/, "")}/api/webhooks/github`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": `bootstrap-${Date.now()}`,
      "X-Hub-Signature-256": signature,
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  console.log(`Probe POST ${endpoint} → ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok) process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  const { adminUrl, idToken } = await resolveAdminIdToken({ adminUrl: args.url });
  const webhookSecret =
    (args.secretFromEnv ? String(process.env.GITHUB_WEBHOOK_SECRET ?? "").trim() : "") ||
    String(args.secret ?? "").trim() ||
    generateWebhookSecret();

  const hookUrl = `${adminUrl}/api/webhooks/github`;
  const saved = await saveGithubWebhookConfig(adminUrl, idToken, {
    repository: args.repo,
    webhookSecret,
    webhookEvents: DEFAULT_GITHUB_WEBHOOK_EVENTS,
  });

  console.log(
    `Mission Control: webhook configured (preview ${saved.config?.webhookSecretPreview ?? "—"})`
  );
  console.log(`Webhook URL: ${hookUrl}`);

  if (!args.skipGh) {
    const gh = ensureGithubRepoWebhook({
      repository: args.repo,
      hookUrl,
      webhookSecret,
      webhookEvents: DEFAULT_GITHUB_WEBHOOK_EVENTS,
    });
    console.log(`GitHub repo hook ${gh.action} (id ${gh.hookId ?? "—"})`);
    console.log("Events: push, release, workflow_run · Content-Type: application/json");
  }

  if (args.probe) {
    await probeWebhook(adminUrl, webhookSecret);
    console.log("\nCheck Settings → GitHub → Recent webhook events and Discord community channel.");
  } else {
    console.log("\nRun with --probe to send a signed test delivery.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
