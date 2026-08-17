import {
  addStoredAdminEmail,
  isMasterEmail,
  listStoredAdminEmails,
  removeStoredAdminEmail,
} from "./_shared/admins.js";
import { logAuthenticatedRequest } from "./_shared/activity-log.js";
import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import { buildInviteHtml, getAdminPublicUrl, sendMail } from "./_shared/mail.js";

export async function onRequestGet(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  if (!isMasterEmail(env, auth.email)) {
    const response = jsonResponse({ error: "Only the master admin can list API admins" }, 403);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  const emails = await listStoredAdminEmails(env);
  const response = jsonResponse({ emails, source: env.ADMIN_KV ? "kv" : "env" });
  return logAuthenticatedRequest(context, auth, response, startedAt);
}

export async function onRequestPost(context) {
  const startedAt = Date.now();
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  if (!isMasterEmail(env, auth.email)) {
    const response = jsonResponse({ error: "Only the master admin can modify API admins" }, 403);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }

  try {
    const body = await request.json();
    const email = body.email;
    const action = body.action ?? "add";

    if (!email || typeof email !== "string") {
      const response = jsonResponse({ error: "email is required" }, 400);
      return logAuthenticatedRequest(context, auth, response, startedAt);
    }

    if (!env.ADMIN_KV?.put) {
      const response = jsonResponse(
        {
          error: "ADMIN_KV binding not configured. Add invited emails to ADMIN_EMAILS env var.",
          hint: "Set ADMIN_EMAILS=colleague@example.com in Cloudflare Pages settings",
        },
        503
      );
      return logAuthenticatedRequest(context, auth, response, startedAt);
    }

    const emails =
      action === "remove"
        ? await removeStoredAdminEmail(env, email)
        : await addStoredAdminEmail(env, email);

    let inviteEmail = { sent: false, reason: "skipped" };
    if (action !== "remove") {
      const inviteUrl = `${getAdminPublicUrl(env)}/login`;
      inviteEmail = await sendMail(env, {
        to: email.trim().toLowerCase(),
        subject: "You're invited to Cursor Curse Monitor Mission Control",
        html: buildInviteHtml({ inviteUrl, invitedBy: auth.email }),
        text: `You've been invited to the Cursor Curse Monitor admin dashboard. Sign in at ${inviteUrl}`,
        category: "invite",
        sentBy: auth.email,
      });
      if (!inviteEmail.sent) {
        console.error("admin invite email failed", inviteEmail.reason);
      }
    }

    const response = jsonResponse({
      ok: true,
      emails,
      action,
      inviteEmail: { sent: inviteEmail.sent, reason: inviteEmail.sent ? undefined : inviteEmail.reason },
    });
    return logAuthenticatedRequest(context, auth, response, startedAt);
  } catch (err) {
    const response = jsonResponse({ error: err instanceof Error ? err.message : "Server error" }, 500);
    return logAuthenticatedRequest(context, auth, response, startedAt);
  }
}
