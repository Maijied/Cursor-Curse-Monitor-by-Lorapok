import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import {
  getMailboxStats,
  listMailboxMessages,
  patchMailboxMessage,
} from "./_shared/mailbox.js";
import { buildComposeHtml, buildSubscribeHtml, buildTestHtml, getAdminPublicUrl, getMailTransportStatus, sendMail } from "./_shared/mail.js";
import { getMailTemplates } from "./_shared/mail-templates.js";
import { testmailInboxAddress, resolveTestmailRuntimeConfig } from "./_shared/testmail-runtime.js";

const COMPOSE_CATEGORIES = new Set([
  "compose",
  "invite",
  "subscribe",
  "support",
  "notice",
  "test",
  "system",
]);

function normalizeComposeCategory(value) {
  const key = String(value ?? "compose").toLowerCase();
  return COMPOSE_CATEGORIES.has(key) ? key : "compose";
}

/**
 * Retrieves mailbox messages or available mail templates for an authenticated administrator.
 *
 * @returns A response containing templates, or filtered and paginated mailbox messages with statistics and transport status.
 */
export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  if (url.searchParams.get("templates") === "1") {
    const response = jsonResponse({ templates: await getMailTemplates(env) });
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

  if (action === "testmail-probe") {
    const config = resolveTestmailRuntimeConfig(env);
    if (!config.ok) {
      const response = jsonResponse({ ok: false, error: config.error }, 503);
      return logAuthenticatedRequest(context, auth, response, startedAt);
    }

    const tag = `ccm-mailbox-${Date.now()}`;
    const to = testmailInboxAddress(config.namespace, tag);
    const startedMs = Date.now() - 5_000;

    const result = await sendMail(env, {
      to,
      subject: "Subscribed to Cursor Curse Monitor updates",
      html: buildSubscribeHtml({ email: to }),
      text: `Thanks for subscribing, ${to}. We'll email you about important updates from Cursor Curse Monitor.`,
      category: "subscribe",
      sentBy: auth.email,
    });

    const response = jsonResponse({
      ok: result.sent,
      emailed: result.sent,
      tag,
      to,
      since: startedMs,
      transport: result.transport,
      mailboxId: result.mailboxId,
      message: result.sent
        ? `Subscribe welcome mail sent to ${to}. Poll testmail.app for tag "${tag}".`
        : `Welcome mail failed: ${result.reason}`,
      reason: result.sent ? undefined : result.reason,
    });
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
    category: normalizeComposeCategory(body.category),
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
