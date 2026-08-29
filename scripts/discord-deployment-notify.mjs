#!/usr/bin/env node
/**
 * Post deployment success/failure cards to Discord from GitHub Actions.
 * Requires DISCORD_DEPLOYMENT_WEBHOOK (mirror Mission Control deployment webhook).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sendDiscordWebhook } from "../website/admin/functions/api/_shared/discord-notify.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string[]} argv
 */
export function parseDiscordNotifyArgs(argv) {
  /** @type {Record<string, string>} */
  const opts = {
    phase: "completed",
    conclusion: "success",
    actionType: process.env.GITHUB_EVENT_NAME ?? "workflow_dispatch",
    target: "Deployment",
    tag: "",
    summary: "",
    runUrl: "",
    deployUrl: "",
    triggeredBy: process.env.GITHUB_ACTOR ?? "",
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--phase" && argv[i + 1]) opts.phase = argv[++i];
    else if (arg === "--conclusion" && argv[i + 1]) opts.conclusion = argv[++i];
    else if (arg === "--action-type" && argv[i + 1]) opts.actionType = argv[++i];
    else if (arg === "--target" && argv[i + 1]) opts.target = argv[++i];
    else if (arg === "--tag" && argv[i + 1]) opts.tag = argv[++i];
    else if (arg === "--summary" && argv[i + 1]) opts.summary = argv[++i];
    else if (arg === "--run-url" && argv[i + 1]) opts.runUrl = argv[++i];
    else if (arg === "--deploy-url" && argv[i + 1]) opts.deployUrl = argv[++i];
    else if (arg === "--triggered-by" && argv[i + 1]) opts.triggeredBy = argv[++i];
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/discord-deployment-notify.mjs [options]

Options:
  --phase completed|started
  --conclusion success|failure|cancelled
  --action-type <workflow action label>
  --target <job or surface name>
  --tag vX.Y.Z
  --summary <short message>
  --run-url <GitHub Actions run URL>
  --deploy-url <live site URL>
  --triggered-by <actor>
`);
      process.exit(0);
    }
  }

  return opts;
}

/**
 * @param {Record<string, string>} opts
 */
export function buildDiscordNotifyPayload(opts) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const tag = opts.tag || `v${pkg.version}`;
  const conclusion = opts.conclusion || "success";
  const summary =
    opts.summary ||
    (conclusion === "success"
      ? `${opts.target} deployed successfully.`
      : `${opts.target} deploy failed — open the workflow run for logs.`);

  const runUrl =
    opts.runUrl ||
    (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null);

  return {
    phase: opts.phase || "completed",
    conclusion,
    actionType: opts.actionType || "workflow_dispatch",
    tag,
    version: tag,
    summary,
    runUrl: runUrl || undefined,
    triggeredBy: opts.triggeredBy || undefined,
    jobs: [{ name: opts.target, conclusion }],
    deployUrl: opts.deployUrl || undefined,
  };
}

/**
 * @param {Record<string, string>} opts
 */
export async function notifyDiscordDeploymentFromCi(opts) {
  const webhookUrl = process.env.DISCORD_DEPLOYMENT_WEBHOOK?.trim();
  if (!webhookUrl) {
    return { ok: false, skipped: true, reason: "no_webhook" };
  }

  const payload = buildDiscordNotifyPayload(opts);
  if (payload.deployUrl && payload.conclusion === "success") {
    payload.summary = `${payload.summary}\n\nLive: ${payload.deployUrl}`;
  }

  return sendDiscordWebhook(webhookUrl, payload, null);
}

async function main() {
  const opts = parseDiscordNotifyArgs(process.argv);
  const result = await notifyDiscordDeploymentFromCi(opts);

  if (result.skipped) {
    console.log("DISCORD_DEPLOYMENT_WEBHOOK not set — skipping Discord notification");
    process.exit(0);
  }

  if (!result.ok) {
    console.error(`::warning::Discord notification failed: ${result.error ?? result.status}`);
    process.exit(0);
  }

  console.log("Discord deployment notification sent");
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  });
}
