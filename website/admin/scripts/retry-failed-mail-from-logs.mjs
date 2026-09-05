#!/usr/bin/env node
/**
 * Pretest mail transport, then resend failed outbound mail recorded in ADMIN_D1 system_logs.
 *
 *   node website/admin/scripts/retry-failed-mail-from-logs.mjs
 *   node website/admin/scripts/retry-failed-mail-from-logs.mjs --dry-run
 *   node website/admin/scripts/retry-failed-mail-from-logs.mjs --since 2026-09-05
 *
 * Uses cred vault (Resend + Cloudflare) and runs mail:probe-production first.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNoticeDraftFromChangelog } from "../functions/api/_shared/changelog-notice.js";
import { buildNoticeHtml, buildSubscribeHtml } from "../functions/api/_shared/mail.js";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(adminDir, "../..");
const adminUrl = String(process.env.ADMIN_URL ?? "https://cursor-dev.lorapok.tech").replace(/\/$/, "");
const d1Name = "ccm-admin-d1";

function parseArgs(argv) {
  /** @type {{ dryRun?: boolean; since?: string; limit?: number; skipProbe?: boolean }} */
  const out = { since: "2026-09-05", limit: 100 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--skip-probe") out.skipProbe = true;
    else if (arg === "--since" && argv[i + 1]) out.since = argv[++i];
    else if (arg.startsWith("--since=")) out.since = arg.slice("--since=".length);
    else if (arg === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (arg.startsWith("--limit=")) out.limit = Number(arg.slice("--limit=".length));
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

function shouldRetryRecipient(email) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  if (e.endsWith("@example.com")) return false;
  if (e.endsWith("@inbox.testmail.app")) return false;
  const local = e.split("@")[0] ?? "";
  if (/^(probe|test|mail-test|mail-verify|check-|post-push|stable-|prod-mail-check)/i.test(local)) return false;
  return true;
}

function runProbe() {
  console.log("Pretest: mail:probe-production…\n");
  const result = spawnSync(
    "npm",
    ["run", "mail:probe-production", "--prefix", "website/admin"],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, ADMIN_URL: adminUrl },
    }
  );
  if (result.status !== 0) {
    throw new Error("mail:probe-production failed — fix transport before retrying failed mail");
  }
}

function queryFailedLogs(since, limit) {
  const sql = `SELECT id, ts, message, meta_json FROM system_logs
    WHERE source = 'mail' AND level = 'error' AND ts >= '${since.replace(/'/g, "''")}'
    AND (meta_json IS NULL OR json_extract(meta_json, '$.retriedAt') IS NULL)
    ORDER BY ts ASC
    LIMIT ${Math.max(1, Math.min(limit, 500))};`;
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", d1Name, "--remote", "--json", "--command", sql],
    { cwd: adminDir, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "D1 query failed");
  }
  const parsed = JSON.parse(result.stdout);
  const rows = parsed?.[0]?.results ?? [];
  return rows
    .map((row) => {
      let meta = {};
      try {
        meta = row.meta_json ? JSON.parse(String(row.meta_json)) : {};
      } catch {
        meta = {};
      }
      const to = String(meta.to ?? "").trim().toLowerCase();
      if (!to) {
        const match = String(row.message ?? "").match(/Email failed to (.+)$/i);
        if (match?.[1]) meta.to = match[1].trim().toLowerCase();
      }
      return { id: row.id, ts: row.ts, meta };
    })
    .filter((row) => row.meta.to);
}

function markLogRetried(logId, note) {
  const safeNote = String(note ?? "resent").replace(/'/g, "''");
  const sql = `UPDATE system_logs
    SET meta_json = json_set(COALESCE(meta_json, '{}'), '$.retriedAt', datetime('now'), '$.retryNote', '${safeNote}')
    WHERE id = '${String(logId).replace(/'/g, "''")}';`;
  spawnSync("npx", ["wrangler", "d1", "execute", d1Name, "--remote", "--command", sql], {
    cwd: adminDir,
    stdio: "inherit",
  });
}

async function buildPayload(meta) {
  const to = String(meta.to ?? "").trim().toLowerCase();
  const subject = String(meta.subject ?? "").trim();
  const category = String(meta.category ?? "system").trim();

  if (category === "subscribe" || /subscribed to cursor curse monitor updates/i.test(subject)) {
    return {
      to,
      subject: "Subscribed to Cursor Curse Monitor updates",
      html: buildSubscribeHtml({ email: to }),
      text: `Thanks for subscribing, ${to}. We'll email you about important updates from Cursor Curse Monitor.`,
      category: "subscribe",
    };
  }

  if (category === "notice" || /cursor curse monitor preview/i.test(subject)) {
    const markdown = readFileSync(resolve(repoRoot, "CHANGELOG.md"), "utf8");
    const draft = buildNoticeDraftFromChangelog(markdown, "unreleased");
    const html = buildNoticeHtml({
      title: draft.title,
      message: draft.message,
      severity: draft.severity,
      feedbackUrl: draft.feedbackUrl,
    });
    return {
      to,
      subject: draft.title,
      html,
      text: draft.message,
      category: "notice",
    };
  }

  return {
    to,
    subject: subject || "Cursor Curse Monitor update",
    html: buildNoticeHtml({
      title: subject || "Cursor Curse Monitor update",
      message: "We're resending a message that failed earlier. Thanks for your patience.",
      severity: "info",
    }),
    text: subject || "Cursor Curse Monitor update",
    category: category || "system",
  };
}

async function sendViaResend(env, payload) {
  const resendKey = String(env.RESEND_API_KEY ?? "").trim();
  if (!resendKey.startsWith("re_")) {
    throw new Error("RESEND_API_KEY missing from cred vault — run mail:sync-vault or setup-resend-secret.mjs");
  }
  const from =
    String(env.RESEND_FROM ?? "").trim() ||
    "Cursor Curse Monitor <cursor.monitor@mail.lorapok.tech>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    return { sent: false, reason: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { sent: true, transport: "resend" };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: retry-failed-mail-from-logs.mjs [--dry-run] [--since YYYY-MM-DD] [--limit N] [--skip-probe]");
    process.exit(0);
  }

  if (!args.skipProbe) runProbe();

  const env = await resolveLocalMailEnvAsync(process.env, adminDir);
  if (!env.RESEND_API_KEY?.trim()) {
    throw new Error("Resend key not loaded — cred vault or RESEND_API_KEY required for external recipients");
  }

  const rows = queryFailedLogs(args.since, args.limit);
  const seen = new Set();
  const queue = [];
  for (const row of rows) {
    const to = String(row.meta.to ?? "").trim().toLowerCase();
    const subject = String(row.meta.subject ?? "").trim();
    const key = `${to}::${subject}::${row.meta.category ?? ""}`;
    if (!shouldRetryRecipient(to) || seen.has(key)) continue;
    seen.add(key);
    queue.push(row);
  }

  console.log(`\nFound ${rows.length} failed mail log row(s); ${queue.length} unique production recipient(s) to retry.\n`);
  if (!queue.length) {
    console.log("Nothing to resend.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const row of queue) {
    const payload = await buildPayload(row.meta);
    if (args.dryRun) {
      console.log(`[dry-run] would send ${payload.category} → ${payload.to} (${payload.subject})`);
      continue;
    }
    const result = await sendViaResend(env, payload);
    if (result.sent) {
      sent += 1;
      console.log(`✓ sent ${payload.category} → ${payload.to}`);
      markLogRetried(row.id, `resent via retry-failed-mail-from-logs (${result.transport})`);
    } else {
      failed += 1;
      console.error(`✗ failed ${payload.to}: ${result.reason}`);
    }
    await sleep(750);
  }

  console.log(`\nDone. sent=${sent} failed=${failed} skipped_test=${rows.length - queue.length}`);
  if (failed > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
