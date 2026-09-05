import { buildNoticeHtml, sendMail } from "./mail.js";
import { readSubscribers } from "./subscribers.js";
import { estimateBroadcastResendCapacity } from "./service-usage.js";

/** Stay under Cloudflare Worker subrequest limits (each sendMail may fan out). */
export const BROADCAST_MAX_PER_INVOCATION = 8;

/**
 * Send a notice-style email to opt-in subscribers (batched per invocation).
 * @param {Record<string, unknown>} env
 * @param {{
 *   title: string;
 *   message: string;
 *   severity?: string;
 *   feedbackUrl?: string;
 *   sentBy?: string | null;
 *   offset?: number;
 *   limit?: number;
 * }} input
 */
export async function broadcastToSubscribers(env, input) {
  const title = String(input.title ?? "").trim();
  const message = String(input.message ?? "").trim();
  if (!title || !message) {
    return { ok: false, error: "title and message are required", sent: 0, failed: 0, total: 0 };
  }

  const subscribers = await readSubscribers(env.ADMIN_KV, env);
  const total = subscribers.length;
  if (!total) {
    return { ok: true, sent: 0, failed: 0, total: 0, done: true, message: "No subscribers to email." };
  }

  const offset = Math.max(0, Number(input.offset ?? 0) || 0);
  const limit = Math.min(
    BROADCAST_MAX_PER_INVOCATION,
    Math.max(1, Number(input.limit ?? BROADCAST_MAX_PER_INVOCATION) || BROADCAST_MAX_PER_INVOCATION)
  );
  const batch = subscribers.slice(offset, offset + limit);
  const nextOffset = offset + batch.length;
  const done = nextOffset >= total;

  const capacity = await estimateBroadcastResendCapacity(env, batch.length);

  const severity = String(input.severity ?? "info");
  const feedbackUrl = String(input.feedbackUrl ?? "").trim();
  const html = buildNoticeHtml({ title, message, severity, feedbackUrl });
  const subject = title;

  let sent = 0;
  let fallbackUsed = 0;
  let failed = 0;
  const results = [];

  for (const row of batch) {
    const result = await sendMail(env, {
      to: row.email,
      subject,
      html,
      text: message,
      category: "notice",
      sentBy: input.sentBy ?? null,
    });
    if (result.sent) sent += 1;
    else failed += 1;
    if (result.sent && result.transport && result.transport !== "resend") fallbackUsed += 1;
    results.push({
      email: row.email,
      sent: result.sent,
      reason: result.reason ?? null,
      transport: result.transport ?? null,
    });
  }

  const quotaNote = capacity.willUseFallback
    ? ` Resend quota allows ${capacity.resendSlots}/${capacity.recipientCount} via Resend; ${capacity.fallbackCount} may use Cloudflare relay/fallback.`
    : "";

  const progressNote = done
    ? ""
    : ` Batch ${Math.floor(offset / limit) + 1}: sent ${sent} in this request (${nextOffset}/${total} processed).`;

  return {
    ok: failed === 0,
    sent,
    failed,
    total,
    offset,
    nextOffset: done ? null : nextOffset,
    done,
    batchSize: batch.length,
    results,
    capacity,
    fallbackUsed,
    message:
      failed === 0
        ? done
          ? `Emailed ${offset + sent} subscriber(s). A copy was BCC'd to ops.${quotaNote}`
          : `Sent ${sent} in this batch (${nextOffset}/${total} so far).${progressNote}${quotaNote}`
        : `Sent ${sent}, failed ${failed} of ${batch.length} in this batch.${progressNote}${quotaNote}`,
  };
}
