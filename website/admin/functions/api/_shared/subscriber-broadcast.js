import { buildNoticeHtml, sendMail } from "./mail.js";
import { renderMailTemplate } from "./mail-template-engine.js";
import { buildSubscriberMergeContext, resolveSubscriberMailContext } from "./subscriber-mail-context.js";
import { readSubscribers } from "./subscribers.js";
import { estimateBroadcastResendCapacity } from "./service-usage.js";

/**
 * Send a notice-style email to every opt-in subscriber with per-recipient merge tags.
 * @param {Record<string, unknown>} env
 * @param {{ title: string; message: string; severity?: string; feedbackUrl?: string; sentBy?: string | null; templateId?: string }} input
 */
export async function broadcastToSubscribers(env, input) {
  const title = String(input.title ?? "").trim();
  const message = String(input.message ?? "").trim();
  if (!title || !message) {
    return { ok: false, error: "title and message are required", sent: 0, failed: 0, total: 0 };
  }

  const subscribers = await readSubscribers(env.ADMIN_KV);
  if (!subscribers.length) {
    return { ok: true, sent: 0, failed: 0, total: 0, message: "No subscribers to email." };
  }

  const capacity = await estimateBroadcastResendCapacity(env, subscribers.length);
  const severity = String(input.severity ?? "info");
  const feedbackUrl = String(input.feedbackUrl ?? "").trim();
  const templateId = String(input.templateId ?? "release-notes").trim() || "release-notes";
  const { productCtx, siteData } = await resolveSubscriberMailContext(env);

  let sent = 0;
  let fallbackUsed = 0;
  let failed = 0;
  const results = [];

  for (const row of subscribers) {
    const mergeCtx = buildSubscriberMergeContext(row, productCtx, siteData, env);
    mergeCtx.title = title;
    mergeCtx.message = message;
    mergeCtx.severity = severity;
    mergeCtx.feedbackUrl = feedbackUrl;

    let subject = title;
    let html = buildNoticeHtml({ title, message, severity, feedbackUrl });
    let text = message;

    try {
      const rendered = await renderMailTemplate(env, templateId, mergeCtx);
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    } catch {
      // fall back to notice HTML above
    }

    const result = await sendMail(env, {
      to: row.email,
      subject,
      html,
      text,
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
    templateId,
    message:
      failed === 0
        ? `Emailed ${sent} subscriber(s). A copy was BCC'd to ops.${quotaNote}`
        : `Sent ${sent}, failed ${failed} of ${subscribers.length}.${quotaNote}`,
  };
}
