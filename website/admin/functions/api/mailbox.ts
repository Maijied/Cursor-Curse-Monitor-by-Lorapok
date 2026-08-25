import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import {
  getMailboxStats,
  listMailboxMessages,
  patchMailboxMessage,
} from "./_shared/mailbox.js";
import { buildComposeHtml, buildTestHtml, getAdminPublicUrl, getMailTransportStatus, sendMail } from "./_shared/mail.js";
import { getMailTemplates } from "./_shared/mail-templates.js";

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  if (url.searchParams.get("templates") === "1") {
    const response = jsonResponse({ templates: getMailTemplates() });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));

  const filtered = await listMailboxMessages(env, {
    direction: url.searchParams.get("direction") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    unreadOnly: url.searchParams.get("unread") === "true",
    q: url.searchParams.get("q") ?? undefined,
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);
  const stats = await getMailboxStats(env);
  const mail = getMailTransportStatus(env);

  const response = jsonResponse({
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
    transport: mail,
  });

  return logAuthenticatedRequest(context, auth, response, startedAt);
}

export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    const response = jsonResponse({ error: "Invalid JSON" }, 400);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const action = String(body.action ?? "send");

  if (action === "mark-read") {
    const id = String(body.id ?? "").trim();
    if (!id) {
      const response = jsonResponse({ error: "id is required" }, 400);
      return logAuthenticatedRequest(context, auth, response, startedAt);
    }
    const updated = await patchMailboxMessage(env, id, { read: true });
    const response = jsonResponse({ ok: Boolean(updated), message: updated });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  if (action === "test") {
    const to = String(body.to ?? auth.email ?? "").trim().toLowerCase();
    if (!to) {
      const response = jsonResponse({ error: "Recipient email is required" }, 400);
      return logAuthenticatedRequest(context, auth, response, startedAt);
    }

    const result = await sendMail(env, {
      to,
      subject: "Cursor Curse Monitor — mailbox test",
      html: buildTestHtml({ email: to, adminUrl: getAdminPublicUrl(env) }),
      text: `Mailbox test from Mission Control at ${new Date().toISOString()}. Outbound mail is working.`,
      category: "test",
      sentBy: auth.email,
    });

    const response = jsonResponse({
      ok: result.sent,
      emailed: result.sent,
      transport: result.transport,
      mailboxId: result.mailboxId,
      message: result.sent
        ? `Test email sent to ${to}`
        : `Test email failed: ${result.reason}`,
      reason: result.sent ? undefined : result.reason,
    });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const to = String(body.to ?? "").trim().toLowerCase();
  const subject = String(body.subject ?? "").trim();
  const text = String(body.text ?? "").trim();

  if (!to || !subject || !text) {
    const response = jsonResponse({ error: "to, subject, and text are required" }, 400);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const result = await sendMail(env, {
    to,
    subject,
    html: buildComposeHtml({ subject, body: text }),
    text,
    category: "compose",
    sentBy: auth.email,
  });

  const response = jsonResponse({
    ok: result.sent,
    emailed: result.sent,
    mailboxId: result.mailboxId,
    message: result.sent ? `Message sent to ${to}` : `Send failed: ${result.reason}`,
    reason: result.sent ? undefined : result.reason,
  });
  return logAuthenticatedRequest(context, auth, response, startedAt);
}
