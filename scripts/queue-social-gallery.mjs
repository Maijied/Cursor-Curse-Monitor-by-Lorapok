#!/usr/bin/env node
/**
 * Queue a SOCIAL-02 gallery job after a successful marketplace deploy (DEPLOY-03).
 * POSTs to Mission Control with CRON_SECRET (same auth as stats-cron worker).
 */
import { shouldQueueSocialGallery } from "../website/admin/functions/api/_shared/social-gallery-queue.js";

const DEFAULT_ADMIN_URL = "https://cursor-dev.lorapok.tech";

/**
 * @param {string[]} argv
 */
export function parseQueueSocialGalleryArgs(argv) {
  /** @type {Record<string, string>} */
  const opts = {
    adminUrl: process.env.ADMIN_URL ?? DEFAULT_ADMIN_URL,
    actionType: process.env.ACTION_TYPE ?? process.env.GITHUB_EVENT_NAME ?? "",
    tag: process.env.TARGET_TAG ?? process.env.TAG ?? "",
    runUrl: "",
    triggeredBy: process.env.GITHUB_ACTOR ?? "github-actions",
    source: "ci",
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--admin-url" && argv[i + 1]) opts.adminUrl = argv[++i];
    else if (arg === "--action-type" && argv[i + 1]) opts.actionType = argv[++i];
    else if (arg === "--tag" && argv[i + 1]) opts.tag = argv[++i];
    else if (arg === "--run-url" && argv[i + 1]) opts.runUrl = argv[++i];
    else if (arg === "--triggered-by" && argv[i + 1]) opts.triggeredBy = argv[++i];
    else if (arg === "--source" && argv[i + 1]) opts.source = argv[++i];
    else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/queue-social-gallery.mjs [options]

Options:
  --admin-url <Mission Control base URL>
  --action-type <workflow_dispatch action label>
  --tag vX.Y.Z
  --run-url <GitHub Actions run URL>
  --triggered-by <actor>
  --source ci|release-prep

Env: CRON_SECRET (required), ADMIN_URL, ACTION_TYPE, TARGET_TAG
`);
      process.exit(0);
    }
  }

  if (
    !opts.runUrl &&
    process.env.GITHUB_SERVER_URL &&
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_RUN_ID
  ) {
    opts.runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  }

  return opts;
}

/**
 * @param {Record<string, string>} opts
 */
export async function queueSocialGalleryFromCi(opts) {
  if (!shouldQueueSocialGallery(opts.actionType)) {
    return { ok: true, skipped: true, reason: "action_not_eligible" };
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return { ok: false, skipped: true, reason: "no_cron_secret" };
  }

  const tag = opts.tag?.trim();
  if (!tag) {
    return { ok: true, skipped: true, reason: "missing_tag" };
  }

  const base = String(opts.adminUrl ?? DEFAULT_ADMIN_URL).replace(/\/$/, "");
  const res = await fetch(`${base}/api/integrations/social/gallery/queue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": secret,
      Accept: "application/json",
    },
    body: JSON.stringify({
      tag,
      actionType: opts.actionType,
      runUrl: opts.runUrl || null,
      triggeredBy: opts.triggeredBy,
      source: opts.source ?? "ci",
    }),
  });

  const text = await res.text().catch(() => "");
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text.slice(0, 200) };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: body.error ?? text.slice(0, 200) };
  }

  return { ok: true, ...body };
}

async function main() {
  const opts = parseQueueSocialGalleryArgs(process.argv);
  const result = await queueSocialGalleryFromCi(opts);

  if (result.skipped) {
    if (result.reason === "no_cron_secret") {
      console.log("::warning::CRON_SECRET not set — skipping social gallery queue");
    } else {
      console.log(`::notice::Social gallery queue skipped (${result.reason})`);
    }
    process.exit(0);
  }

  if (!result.ok) {
    console.error(`::warning::Social gallery queue failed: ${result.error ?? result.status}`);
    process.exit(0);
  }

  if (result.skipped) {
    console.log(`::notice::Social gallery queue skipped (${result.reason})`);
    process.exit(0);
  }

  console.log(`::notice::Social gallery job queued for ${opts.tag}`);
}

const isCli = process.argv[1]?.endsWith("queue-social-gallery.mjs");
if (isCli) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  });
}
