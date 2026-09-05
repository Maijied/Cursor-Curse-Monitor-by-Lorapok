import { listMailboxMessages, patchMailboxMessage } from "./mailbox.js";
import { sendMail } from "./mail.js";

/**
 * Resend outbound mailbox messages that failed delivery.
 *
 * @param {Record<string, unknown>} env
 * @param {{ sentBy?: string | null; limit?: number; includeRetried?: boolean }} [options]
 */
export async function retryFailedMailboxMessages(env, options = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const sentBy = options.sentBy ?? null;
  const includeRetried = options.includeRetried === true;

  const failed = await listMailboxMessages(env, { status: "failed", direction: "outbound" });
  const pending = failed
    .filter((row) => includeRetried || !row.retriedAt)
    .slice(0, limit);

  const seen = new Set();
  const results = [];

  for (const message of pending) {
    const to = String(message.to ?? "").trim().toLowerCase();
    const subject = String(message.subject ?? "").trim();
    const dedupeKey = `${to}::${subject}`;
    if (!to || !subject || seen.has(dedupeKey)) {
      results.push({
        id: message.id,
        to,
        subject,
        skipped: true,
        reason: seen.has(dedupeKey) ? "duplicate_recipient_subject" : "missing_recipient_or_subject",
      });
      continue;
    }
    seen.add(dedupeKey);

    const result = await sendMail(env, {
      to,
      subject,
      html: String(message.html ?? ""),
      text: String(message.text ?? subject),
      category: message.category ?? "system",
      sentBy: sentBy ?? message.sentBy ?? null,
    });

    const retriedAt = new Date().toISOString();
    if (result.sent) {
      await patchMailboxMessage(env, message.id, {
        status: "sent",
        error: null,
        retriedAt,
        read: true,
      });
    } else {
      await patchMailboxMessage(env, message.id, {
        retriedAt,
        error: result.reason ? `Retry failed: ${result.reason}` : "Retry failed",
      });
    }

    results.push({
      id: message.id,
      to,
      subject,
      sent: result.sent,
      transport: result.transport,
      mailboxId: result.mailboxId,
      reason: result.sent ? undefined : result.reason,
    });
  }

  const sent = results.filter((row) => row.sent).length;
  const skipped = results.filter((row) => row.skipped).length;
  const stillFailed = results.filter((row) => !row.sent && !row.skipped).length;

  return {
    ok: stillFailed === 0,
    attempted: results.length,
    sent,
    skipped,
    failed: stillFailed,
    results,
  };
}
