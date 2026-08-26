/**
 * Internal mail relay for Mission Control (Pages Functions → Worker send_email binding).
 * Invoked only via Pages service binding — not exposed on the public internet.
 */
import {
  normalizeMailFromInput,
  toWorkerFrom,
  toWorkerRecipient,
  toWorkerRecipients,
  toWorkerReplyTo,
} from "../../../functions/api/_shared/mail-normalize.js";

export default {
  /**
   * @param {Request} request
   * @param {{ EMAIL?: { send: (msg: Record<string, unknown>) => Promise<unknown> } }} env
   */
  async fetch(request, env) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { to, from, subject, html, text, bcc, replyTo } = body ?? {};
    if (!to || (!from?.email && !from?.address) || !subject) {
      return Response.json({ error: "to, from.email, and subject are required" }, { status: 400 });
    }

    if (!env.EMAIL?.send) {
      return Response.json(
        { sent: false, reason: "EMAIL send_email binding is missing on ccm-mail-relay worker" },
        { status: 500 }
      );
    }

    try {
      const normalizedFrom = normalizeMailFromInput(from);
      await env.EMAIL.send({
        to: toWorkerRecipient(to),
        from: toWorkerFrom(normalizedFrom),
        subject,
        html: html ?? `<p>${subject}</p>`,
        text: text ?? subject,
        ...(Array.isArray(bcc) && bcc.length ? { bcc: toWorkerRecipients(bcc) } : {}),
        ...(replyTo || normalizedFrom.replyTo
          ? { replyTo: toWorkerReplyTo(replyTo, normalizedFrom.replyTo) }
          : {}),
      });
      return Response.json({ sent: true, transport: "cloudflare-relay" });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "EMAIL.send failed";
      return Response.json({ sent: false, reason }, { status: 502 });
    }
  },
};
