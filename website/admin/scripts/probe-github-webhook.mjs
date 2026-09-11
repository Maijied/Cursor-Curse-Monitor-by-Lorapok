#!/usr/bin/env node
/**
 * Smoke: sign a GitHub webhook payload and POST to Mission Control ingest.
 *
 * Usage:
 *   npm run github:webhook:probe --prefix website/admin
 *   GITHUB_WEBHOOK_SECRET=... node website/admin/scripts/probe-github-webhook.mjs
 *
 * Full bootstrap (MC save + gh hook + probe):
 *   npm run github:webhook:bootstrap --prefix website/admin
 */
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveAdminIdToken } from "./lib/admin-api-auth.mjs";
import {
  DEFAULT_GITHUB_WEBHOOK_EVENTS,
  ensureGithubRepoWebhook,
  generateWebhookSecret,
  saveGithubWebhookConfig,
} from "./lib/github-webhook-bootstrap.mjs";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_URL = process.env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech";
const DEFAULT_REPO = "Maijied/Cursor-Curse-Monitor-by-Lorapok";

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, event: "push", preview: false, bootstrap: false, repo: DEFAULT_REPO };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--url" && argv[i + 1]) args.url = argv[++i].replace(/\/$/, "");
    else if (argv[i] === "--event" && argv[i + 1]) args.event = argv[++i];
    else if (argv[i] === "--repo" && argv[i + 1]) args.repo = argv[++i];
    else if (argv[i] === "--preview") args.preview = true;
    else if (argv[i] === "--bootstrap") args.bootstrap = true;
  }
  return args;
}

function loadSecretFromKv(preview) {
  const previewFlag = preview ? "--preview" : "--preview=false";
  const res = spawnSync(
    "npx",
    ["wrangler", "kv", "key", "get", "--binding=ADMIN_KV", previewFlag, "integrations:github"],
    { cwd: adminRoot, encoding: "utf8", env: process.env }
  );
  if (res.status !== 0) return null;
  try {
    const parsed = JSON.parse(res.stdout.trim());
    const secret = String(parsed.webhookSecret ?? "").trim();
    return secret || null;
  } catch {
    return null;
  }
}

async function bootstrapWebhookSecret(args) {
  const { adminUrl, idToken } = await resolveAdminIdToken({ adminUrl: args.url });
  const webhookSecret = generateWebhookSecret();
  const hookUrl = `${adminUrl}/api/webhooks/github`;

  const putJson = await saveGithubWebhookConfig(adminUrl, idToken, {
    repository: args.repo,
    webhookSecret,
    webhookEvents: DEFAULT_GITHUB_WEBHOOK_EVENTS,
  });
  console.log(
    `Saved webhook config (preview ${putJson.config?.webhookSecretPreview ?? "—"}, configured=${putJson.config?.webhookConfigured})`
  );

  const gh = ensureGithubRepoWebhook({
    repository: args.repo,
    hookUrl,
    webhookSecret,
    webhookEvents: DEFAULT_GITHUB_WEBHOOK_EVENTS,
  });
  console.log(`GitHub repo hook ${gh.action} (id ${gh.hookId ?? "—"}) → ${hookUrl}`);
  return webhookSecret;
}

async function signBody(secret, body) {
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${digest}`;
}

function buildPayload(event, repo) {
  if (event === "release") {
    return {
      action: "published",
      release: {
        tag_name: "v0.0.0-smoke",
        html_url: `https://github.com/${repo}/releases/tag/v0.0.0-smoke`,
      },
      repository: { full_name: repo },
    };
  }
  return {
    ref: "refs/heads/main",
    repository: { full_name: repo },
    pusher: { name: "mission-control-probe" },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  let secret = String(process.env.GITHUB_WEBHOOK_SECRET ?? "").trim();
  if (args.bootstrap) {
    secret = await bootstrapWebhookSecret(args);
  }
  if (!secret) {
    secret = loadSecretFromKv(args.preview);
  }
  if (!secret) {
    console.error(
      "No webhook secret. Run: npm run github:webhook:bootstrap --prefix website/admin\n" +
        "Or set GITHUB_WEBHOOK_SECRET / ADMIN_EMAIL+ADMIN_PASSWORD / ADMIN_ID_TOKEN with --bootstrap."
    );
    process.exit(1);
  }

  const body = JSON.stringify(buildPayload(args.event, args.repo));
  const signature = await signBody(secret, body);
  const deliveryId = `probe-${Date.now()}`;
  const endpoint = `${args.url}/api/webhooks/github`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": args.event,
      "X-GitHub-Delivery": deliveryId,
      "X-Hub-Signature-256": signature,
    },
    body,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  console.log(`POST ${endpoint} → ${res.status}`);
  console.log(JSON.stringify(json, null, 2));

  if (!res.ok) {
    process.exit(1);
  }

  const fanOut = json.fanOut ?? json.fanout;
  if (fanOut) {
    console.log("\nFan-out:", JSON.stringify(fanOut, null, 2));
  }

  console.log("\nVerify in Mission Control → Settings → GitHub → Recent webhook events.");
  console.log("Discord: check community channel for GitHub push/release embed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
