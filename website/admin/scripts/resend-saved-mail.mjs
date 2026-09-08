#!/usr/bin/env node
/**
 * List and optionally replay mailbox messages stored in ADMIN_KV (`mailbox:messages`).
 *
 * Audit scatter keys (`mail:audit:resend:*`) are listed for visibility only — payloads
 * are masked and cannot be replayed.
 *
 * Usage (dry-run default):
 *   node website/admin/scripts/resend-saved-mail.mjs
 *   node website/admin/scripts/resend-saved-mail.mjs --send
 *   node website/admin/scripts/resend-saved-mail.mjs --only-failed --send --delay-ms 1500
 *
 * Redirect default: MAIL_REDIRECT_TO env or cred vault cursor/mail_redirect_to (safe bulk replay).
 * Override: --redirect-to=addr or --no-redirect
 *
 * Requires wrangler OAuth or CLOUDFLARE_API_TOKEN for production ADMIN_KV reads.
 * Sends use cred vault mail secrets (RESEND_API_KEY, CLOUDFLARE_EMAIL_API_TOKEN).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAILBOX_KEY,
  buildReplayPayload,
  isReplayable,
  listAuditSummary,
  loadD1MailMessages,
  loadMailboxReplayMessages,
  maskEmail,
  maskEmailDisplay,
  resolveMailRedirectTo,
  sendMail,
} from "../services/mail/index.js";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const opts = {
    send: false,
    onlyFailed: false,
    onlyOutbound: true,
    limit: 0,
    delayMs: 1000,
    redirectTo: "",
    noRedirect: false,
    preview: false,
    listAudit: true,
    source: "mailbox",
    dedupe: true,
    allAttempts: false,
  };

  for (const arg of argv) {
    if (arg === "--send") opts.send = true;
    else if (arg === "--dry-run") opts.send = false;
    else if (arg === "--only-failed") opts.onlyFailed = true;
    else if (arg === "--all-directions") opts.onlyOutbound = false;
    else if (arg === "--preview") opts.preview = true;
    else if (arg === "--no-audit") opts.listAudit = false;
    else if (arg === "--all-attempts") opts.allAttempts = true;
    else if (arg === "--no-dedupe") opts.dedupe = false;
    else if (arg === "--no-redirect") opts.noRedirect = true;
    else if (arg.startsWith("--source=")) opts.source = arg.slice(9).trim().toLowerCase();
    else if (arg.startsWith("--limit=")) opts.limit = Math.max(0, Number.parseInt(arg.slice(8), 10) || 0);
    else if (arg.startsWith("--delay-ms=")) opts.delayMs = Math.max(0, Number.parseInt(arg.slice(11), 10) || 0);
    else if (arg.startsWith("--redirect-to=")) opts.redirectTo = arg.slice(14).trim().toLowerCase();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node website/admin/scripts/resend-saved-mail.mjs [options]

Options:
  --dry-run          List messages without sending (default)
  --send             Actually deliver mail (no KV side effects; D1 unchanged)
  --source=mailbox   Read mailbox:messages KV blob (default)
  --source=d1        Reconstruct from D1 system_logs (source=mail; no stored body)
  --source=all       Merge mailbox KV + D1 logs
  --only-failed      Replay failed only (mailbox status or D1 "Email failed" rows)
  --all-directions   Include inbound mailbox rows
  --all-attempts     Include duplicate D1 send attempts (default: dedupe by to+subject+category)
  --no-dedupe        Alias for --all-attempts on D1 source
  --limit=N          Cap messages processed (0 = all)
  --delay-ms=N       Pause between sends (default 1000)
  --redirect-to=ADDR Replace recipient for all sends (overrides vault MAIL_REDIRECT_TO)
  --no-redirect      Send to original recipients (disables vault default redirect)
  --preview          Use wrangler KV preview namespace
  --no-audit         Skip listing mail:audit:resend scatter keys
`);
      process.exit(0);
    }
  }

  if (opts.allAttempts) opts.dedupe = false;

  return opts;
}

function loadKvNamespace({ preview = false } = {}) {
  const previewFlag = preview ? "--preview=true" : "--preview=false";

  return {
    async get(key) {
      const out = spawnSync(
        "npx",
        ["wrangler", "kv", "key", "get", "--binding=ADMIN_KV", previewFlag, key],
        { cwd: adminDir, encoding: "utf8", env: process.env }
      );
      if (out.status !== 0) return null;
      return out.stdout;
    },
    async put(key, value) {
      const put = spawnSync(
        "npx",
        ["wrangler", "kv", "key", "put", "--binding=ADMIN_KV", previewFlag, key, value],
        { cwd: adminDir, encoding: "utf8", env: process.env }
      );
      if (put.status !== 0) {
        throw new Error((put.stderr || put.stdout || "kv put failed").trim());
      }
    },
    async list({ prefix = "" } = {}) {
      const keys = [];
      let cursor;
      do {
        const args = [
          "wrangler",
          "kv",
          "key",
          "list",
          "--binding=ADMIN_KV",
          previewFlag,
          "--prefix",
          prefix,
        ];
        if (cursor) args.push("--cursor", cursor);
        const out = spawnSync("npx", args, { cwd: adminDir, encoding: "utf8", env: process.env });
        if (out.status !== 0) {
          throw new Error((out.stderr || out.stdout || "kv list failed").trim());
        }
        const text = out.stdout.trim();
        if (!text) break;
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          const names = text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          keys.push(...names.map((name) => ({ name })));
          break;
        }
        if (Array.isArray(parsed)) {
          keys.push(...parsed.map((row) => ({ name: row.name })));
          cursor = undefined;
        } else {
          keys.push(...(parsed.keys ?? []).map((row) => ({ name: row.name })));
          cursor = parsed.list_complete === false ? parsed.cursor : undefined;
        }
      } while (cursor);
      return { keys, list_complete: true };
    },
  };
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const mailEnv = {
    ...(await resolveLocalMailEnvAsync(process.env, adminDir)),
    CCM_MAIL_SKIP_MAILBOX: "1",
    CCM_MAIL_SKIP_USAGE: "1",
    CCM_MAIL_SKIP_AUDIT: "1",
    CCM_MAIL_SKIP_SYSTEM_LOG: "1",
    CCM_SKIP_KV_BACKUP: "1",
  };
  const readEnv = { ...mailEnv, ADMIN_KV: loadKvNamespace({ preview: opts.preview }) };

  if (!opts.noRedirect && !opts.redirectTo) {
    opts.redirectTo = resolveMailRedirectTo(mailEnv);
  }

  console.log(`Resend saved mail — mode: ${opts.send ? "SEND" : "dry-run"}`);
  if (opts.redirectTo) {
    console.log(`Redirecting all recipients → ${maskEmail(opts.redirectTo)}`);
  } else if (opts.send) {
    console.log("No redirect — delivering to original recipients.");
  }
  console.log("");

  let messages = [];

  if (opts.source === "mailbox" || opts.source === "all") {
    const rawMailbox = await readEnv.ADMIN_KV.get(MAILBOX_KEY);
    if (!rawMailbox) {
      console.log(`KV ${MAILBOX_KEY}: not present (empty mailbox blob).`);
    }
    messages.push(
      ...(await loadMailboxReplayMessages(readEnv, {
        onlyFailed: opts.onlyFailed,
        onlyOutbound: opts.onlyOutbound,
      }))
    );
  }

  if (opts.source === "d1" || opts.source === "all") {
    const d1Rows = await loadD1MailMessages(adminDir, {
      onlyFailed: opts.onlyFailed,
      dedupe: opts.dedupe,
      limit: 0,
    });
    if (opts.source === "all") {
      const mailboxKeys = new Set(messages.map((m) => `${m.to}|${m.subject}|${m.category}`));
      for (const row of d1Rows) {
        const key = `${row.to}|${row.subject}|${row.category}`;
        if (!mailboxKeys.has(key)) messages.push(row);
      }
    } else {
      messages = d1Rows;
    }
  }

  if (opts.limit > 0) {
    messages = messages.slice(0, opts.limit);
  }

  console.log(`Source: ${opts.source} — ${messages.length} message(s) selected`);
  for (const message of messages) {
    console.log(
      `  · [${message.source ?? "mailbox"}] ${String(message.id).slice(0, 8)}… ${message.status} ${message.category} ` +
        `${maskEmailDisplay(message.from)} → ${maskEmail(message.to)} ` +
        `"${String(message.subject ?? "").slice(0, 60)}"`
    );
  }
  console.log("");

  if (opts.listAudit) {
    try {
      const audit = await listAuditSummary(readEnv.ADMIN_KV);
      console.log(`Audit scatter (mail:audit:resend:*): ${audit.count} record(s) (masked — not replayable)`);
      for (const row of audit.sample) {
        console.log(
          `  · ${row.id?.slice(0, 8) ?? "?"}… ${row.status} ${row.transport} ` +
            `${row.from} → ${row.to} "${row.subjectPreview ?? ""}"`
        );
      }
      if (audit.count > audit.sample.length) {
        console.log(`  … and ${audit.count - audit.sample.length} more`);
      }
      console.log("");
    } catch (err) {
      console.warn(`Audit list skipped: ${err instanceof Error ? err.message : err}`);
      console.log("");
    }
  }

  const results = [];
  for (const message of messages) {
    const replayable = isReplayable(message);
    if (!replayable.ok) {
      results.push({
        id: message.id,
        action: "skipped",
        reason: replayable.reason,
        from: maskEmailDisplay(message.from),
        to: maskEmail(message.to),
        subject: String(message.subject ?? "").slice(0, 80),
      });
      continue;
    }

    const payload = buildReplayPayload(message, opts.redirectTo);

    if (!opts.send) {
      results.push({
        id: message.id,
        action: "dry-run",
        from: maskEmailDisplay(message.from),
        to: maskEmail(payload.to),
        subject: payload.subject.slice(0, 80),
        category: payload.category,
        originalStatus: message.status,
      });
      continue;
    }

    try {
      const sendPayload = {
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        category: payload.category,
        sentBy: payload.sentBy,
      };
      if (payload.from) {
        sendPayload.from = payload.from;
      }

      const result = await sendMail(mailEnv, {
        ...sendPayload,
        skipMailbox: true,
        skipUsage: true,
        skipAudit: true,
        skipSystemLog: true,
      });
      results.push({
        id: message.id,
        action: result.sent ? "sent" : "failed",
        transport: result.transport ?? null,
        messageId: result.messageId ? `${String(result.messageId).slice(0, 8)}…` : null,
        reason: result.sent ? undefined : result.reason,
        from: maskEmailDisplay(message.from),
        to: maskEmail(payload.to),
        subject: payload.subject.slice(0, 80),
        mailboxId: result.mailboxId ? `${String(result.mailboxId).slice(0, 8)}…` : null,
      });
    } catch (err) {
      results.push({
        id: message.id,
        action: "failed",
        reason: err instanceof Error ? err.message : String(err),
        from: maskEmailDisplay(message.from),
        to: maskEmail(payload.to),
        subject: payload.subject.slice(0, 80),
      });
    }

    if (opts.delayMs > 0) {
      await sleep(opts.delayMs);
    }
  }

  console.log("Results:");
  const counts = { sent: 0, failed: 0, skipped: 0, "dry-run": 0 };
  for (const row of results) {
    counts[row.action] = (counts[row.action] ?? 0) + 1;
    const extra = [
      row.transport ? `transport=${row.transport}` : "",
      row.messageId ? `msg=${row.messageId}` : "",
      row.reason ? `reason=${row.reason}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    console.log(
      `  ${row.action.padEnd(7)} ${row.id.slice(0, 8)}… ${row.from} → ${row.to} "${row.subject}"${extra ? ` (${extra})` : ""}`
    );
  }

  console.log("");
  console.log(
    `Summary: ${counts.sent ?? 0} sent, ${counts.failed ?? 0} failed, ${counts.skipped ?? 0} skipped, ${counts["dry-run"] ?? 0} dry-run`
  );

  if (!opts.send && messages.length > 0) {
    console.log("\nPass --send to deliver. Vault MAIL_REDIRECT_TO applies by default; use --no-redirect to disable.");
  }

  if (opts.send && (counts.failed ?? 0) > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
