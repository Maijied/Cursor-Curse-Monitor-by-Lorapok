/**
 * Masked Resend mail audit worker — invoked only via Pages MAIL_AUDIT service binding.
 */
import { buildResendAuditEntry, persistMailAuditEntry } from "../../../functions/api/_shared/mail-audit-log.js";

export default {
  /**
   * @param {Request} request
   * @param {Record<string, unknown>} env
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

    const { from, to, subject, subjectPreview, transport, status, messageId, category, sentBy, error, id, ts } =
      body ?? {};

    if (!from || !to) {
      return Response.json({ error: "from and to are required" }, { status: 400 });
    }

    const entry = buildResendAuditEntry({
      id,
      ts,
      from,
      to,
      subject: subjectPreview ?? subject ?? "",
      transport,
      status,
      messageId,
      category,
      sentBy,
      error,
    });

    const logged = await persistMailAuditEntry(env, entry);
    if (!logged) {
      return Response.json(
        { logged: false, reason: "No STATS_R2, ADMIN_D1, or ADMIN_KV binding on ccm-mail-audit" },
        { status: 500 }
      );
    }

    return Response.json({ logged: true, id: entry.id });
  },
};
