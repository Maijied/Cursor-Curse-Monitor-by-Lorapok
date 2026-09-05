import { buildNoticeHtml, sendMail } from "./mail.js";
import { readSubscribers } from "./subscribers.js";
import { estimateBroadcastResendCapacity } from "./service-usage.js";

/**
 * Send a notice-style email to every opt-in subscriber.
 * @param {Record<string, unknown>} env
 * @param {{ title: string; message: string; severity?: string; feedbackUrl?: string; sentBy?: string | null }} input
 */
export async function broadcastToSubscribers(env, input) {
  const title = String(input.title ?? "").trim();
  const message = String(input.message ?? "").trim();
  if (!title || !message) {
    return { ok: false, error: "title and message are required", sent: 0, failed: 0, total: 0 };
  }

  const subscribers = await readSubscribers(env.ADMIN_KV, env);
  if (!subscribers.length) {
    return { ok: true, sent: 0, failed: 0, total: 0, message: "No subscribers to email." };
  }

  const capacity = await estimateBroadcastResendCapacity(env, subscribers.length);

  const severity = String(input.severity ?? "info");
  const feedbackUrl = String(input.feedbackUrl ?? "").trim();
  const html = buildNoticeHtml({ title, message, severity, feedbackUrl });
  const subject = title;

  let sent = 0;
  let fallbackUsed = 0;
  let failed = 0;
  const results = [];

  for (const row of subscribers) {
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

  return {
    ok: failed === 0,
    sent,
    failed,
    total: subscribers.length,
    results,
    capacity,
    fallbackUsed,
    message:
      failed === 0
        ? `Emailed ${sent} subscriber(s). A copy was BCC'd to ops.${quotaNote}`
        : `Sent ${sent}, failed ${failed} of ${subscribers.length}.${quotaNote}`,
  };
}
