import { recordMailboxMessage } from "./mailbox.js";
import { logSystemEvent } from "./system-log.js";
import { resolveMailBranding } from "./mail-branding.js";
import { getMessageCatalog } from "./message-cards-runtime.js";
import {
  coerceMailDisplayName,
  normalizeMailFromInput,
  toRestFrom,
  toRestRecipients,
  toRestReplyTo,
  toWorkerFrom,
  toWorkerRecipient,
  toWorkerRecipients,
  toWorkerReplyTo,
} from "./mail-normalize.js";
import {
  MAIL_HELP,
  MAIL_MONITOR,
  MAIL_OPS_COPY,
  defaultMailBcc,
  resolveMailFrom,
} from "./mail-addresses.js";

const FROM_EMAIL = MAIL_MONITOR;
const FROM_NAME = "Cursor Curse Monitor";
const DEFAULT_ADMIN_URL = "https://cursor-dev.lorapok.tech";

/** Clarify Cloudflare sandbox errors returned by EMAIL.send / REST. */
function formatOutboundMailFailure(reason) {
  const text = String(reason ?? "");
  if (/verified address/i.test(text)) {
    return (
      "destination address is not a verified address. Cloudflare Email Sending on Workers Free only delivers to verified destination addresses. " +
      "Configure RESEND_API_KEY on Pages (see website/admin/scripts/setup-resend-secret.mjs) or upgrade to Workers Paid."
    );
  }
  return text;
}

function isVerifiedDestinationSandboxError(reason) {
  return /verified address/i.test(String(reason ?? ""));
}

function resendConfigured(env) {
  return typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim().length > 0;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ctaButton(label, href) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;padding:13px 22px;border-radius:12px;background:linear-gradient(135deg,#7c5cff,#4d9fff);color:#ffffff;text-decoration:none;font-weight:700;letter-spacing:0.02em;box-shadow:0 10px 30px rgba(124,92,255,0.35);">${escapeHtml(label)}</a>`;
}

function statPill(label, value) {
  return `<td style="padding:10px 14px;border-radius:10px;background:rgba(124,92,255,0.12);border:1px solid rgba(124,92,255,0.25);">
    <p style="margin:0;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(label)}</p>
    <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#f8fafc;">${escapeHtml(value)}</p>
  </td>`;
}

function emailShell(title, bodyHtml, { preheader = "", fromEmail = FROM_EMAIL, fromName = FROM_NAME, category = "system", severity } = {}) {
  const branding = resolveMailBranding(category, { severity });
  const safePreheader = escapeHtml(preheader || title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${escapeHtml(title)}</title>
  <style>
    @keyframes ccm-shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
    @keyframes ccm-glow { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
    .ccm-bar { animation: ccm-shimmer 6s linear infinite; }
    .ccm-glow { animation: ccm-glow 3s ease-in-out infinite; }
  </style>
</head>
<body style="margin:0;padding:0;background:#06080d;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at 20% 0%,rgba(124,92,255,0.18),transparent 45%),radial-gradient(circle at 90% 100%,rgba(77,159,255,0.12),transparent 40%),#06080d;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:rgba(12,16,24,0.96);border:1px solid rgba(124,92,255,0.28);border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,0.55);">
          <tr>
            <td class="ccm-bar" style="height:5px;background:${branding.barGradient};background-size:300% 100%;"></td>
          </tr>
          <tr>
            <td style="padding:26px 28px 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img src="${escapeHtml(branding.logoUrl)}" alt="Cursor Curse Monitor" width="48" height="48" style="display:block;border-radius:12px;margin-bottom:12px;" />
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a5b4fc;font-weight:700;">Lorapok Labs</p>
                    <p style="margin:0;font-size:13px;color:#64748b;">Cursor Curse Monitor · Mission Control</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span class="ccm-glow" style="display:inline-block;padding:6px 10px;border-radius:999px;border:1px solid ${branding.accentColor}88;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${branding.accentColor};font-weight:700;">${escapeHtml(branding.badgeLabel)}</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:18px 0 0;font-size:24px;line-height:1.25;color:#f8fafc;font-weight:800;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 28px 28px;color:#cbd5e1;font-size:15px;line-height:1.65;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 26px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid rgba(148,163,184,0.16);padding-top:18px;">
                <tr>
                  <td style="color:#64748b;font-size:12px;line-height:1.55;">
                    <strong style="color:#94a3b8;">${escapeHtml(fromName)}</strong><br />
                    ${escapeHtml(fromEmail)} · Lorapok Labs product mail
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getAdminPublicUrl(env) {
  const raw = typeof env.ADMIN_PUBLIC_URL === "string" ? env.ADMIN_PUBLIC_URL.trim() : "";
  return (raw || DEFAULT_ADMIN_URL).replace(/\/$/, "");
}

export function buildInviteHtml({ inviteUrl, invitedBy }) {
  const invitedByLine = invitedBy
    ? `Invited by <strong style="color:#e2e8f0;">${escapeHtml(invitedBy)}</strong>.`
    : "Use your Google account or email magic link to sign in.";
  const body = `
    <p style="margin:0 0 16px;">You've been invited to <strong style="color:#f8fafc;">Mission Control</strong> — the Lorapok Labs admin dashboard for Cursor Curse Monitor.</p>
    <p style="margin:0 0 20px;color:#94a3b8;">${invitedByLine}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;"><tr>
      ${statPill("Access", "Admin")}
      ${statPill("Scope", "Deploy & notices")}
    </tr></table>
    ${ctaButton("Open admin dashboard", inviteUrl)}
  `;
  return emailShell("Admin invitation", body, { preheader: "Your Mission Control access is ready.", category: "invite" });
}

export function buildSubscribeHtml({ email }) {
  const safeEmail = escapeHtml(email);
  const body = `
    <p style="margin:0 0 16px;">You're on the list for <strong style="color:#f8fafc;">Cursor Curse Monitor</strong> release and product updates from Lorapok Labs.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;"><tr>
      ${statPill("Subscriber", safeEmail)}
      ${statPill("Channel", "Product news")}
    </tr></table>
    <p style="margin:0;color:#94a3b8;">Reply to this email any time to unsubscribe.</p>
  `;
  return emailShell("You're subscribed", body, { preheader: "Thanks for subscribing to CCM updates.", category: "subscribe" });
}

export function buildTestHtml({ email, adminUrl }) {
  const safeEmail = escapeHtml(email);
  const body = `
    <p style="margin:0 0 16px;">This is a <strong style="color:#34d399;">live delivery test</strong> from Mission Control mailbox transport.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;"><tr>
      ${statPill("Recipient", safeEmail)}
      ${statPill("Status", "Delivered")}
    </tr></table>
    <p style="margin:0 0 18px;color:#94a3b8;">If you received this message, outbound mail from <code style="color:#c7d2fe;">${FROM_EMAIL}</code> is configured correctly.</p>
    ${ctaButton("Open Mission Control", adminUrl)}
  `;
  return emailShell("Mailbox test — delivery confirmed", body, { preheader: "CCM outbound mail is working.", category: "test" });
}

export function buildComposeHtml({ subject, body }) {
  const safeBody = escapeHtml(body);
  const content = `
    <p style="margin:0 0 14px;color:#94a3b8;">Message from Lorapok Labs Mission Control:</p>
    <div style="padding:16px 18px;border-radius:12px;background:rgba(17,24,39,0.85);border:1px solid rgba(124,92,255,0.22);white-space:pre-wrap;color:#e2e8f0;">${safeBody}</div>
  `;
  return emailShell(subject, content, { preheader: body.slice(0, 120), category: "compose" });
}

/**
 * Builds an HTML email for a development notice.
 * @param {Object} options - Notice content and presentation options.
 * @param {string} options.title - The notice title.
 * @param {string} options.message - The notice message.
 * @param {string} options.severity - The notice severity.
 * @param {string} [options.feedbackUrl] - Optional URL for sending feedback.
 * @return {string} The formatted development notice email.
 */
export function buildNoticeHtml({ title, message, severity, feedbackUrl }) {
  const severityColor =
    severity === "critical" ? "#ff6b6b" : severity === "warning" ? "#fbbf24" : "#4d9fff";
  const severityLabel =
    severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "Info";
  const safeTitle = escapeHtml(title || "Development notice");
  const safeMessage = escapeHtml(message ?? "");
  const feedbackLabel = getMessageCatalog().footers?.email?.feedbackCta ?? "Send feedback";
  const feedbackLink = feedbackUrl ? ctaButton(feedbackLabel, feedbackUrl) : "";
  const body = `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px;"><tr>
      ${statPill("Severity", severityLabel)}
      ${statPill("Product", "CCM")}
    </tr></table>
    <p style="margin:0 0 12px;padding:12px 14px;border-radius:10px;background:rgba(124,92,255,0.1);border-left:4px solid ${severityColor};color:#f8fafc;font-weight:700;">${safeTitle}</p>
    <p style="margin:0 0 22px;white-space:pre-wrap;">${safeMessage}</p>
    ${feedbackLink}
  `;
  return emailShell(title || "Development notice", body, {
    preheader: message?.slice(0, 120) ?? safeTitle,
    category: "notice",
    severity,
  });
}

function readCloudflareMailCredentials(env) {
  const accountId =
    typeof env.CLOUDFLARE_ACCOUNT_ID === "string" ? env.CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const dedicated =
    typeof env.CLOUDFLARE_EMAIL_API_TOKEN === "string" ? env.CLOUDFLARE_EMAIL_API_TOKEN.trim() : "";
  const token = dedicated;
  return { accountId, token };
}

/**
 * @param {Record<string, unknown>} env
 */
export function getMailTransportStatus(env) {
  const relayBound = Boolean(env.MAIL_RELAY?.fetch);
  const bindingPresent = Boolean(env.EMAIL?.send);
  const { accountId, token } = readCloudflareMailCredentials(env);
  const restConfigured = Boolean(accountId && token);
  const resendConfigured =
    typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim().length > 0;

  if (relayBound) {
    return {
      configured: true,
      transport: "cloudflare-relay",
      relayBound: true,
      restConfigured,
      resendConfigured,
    };
  }

  if (bindingPresent) {
    return {
      configured: true,
      transport: "cloudflare-binding",
      relayBound: false,
      restConfigured,
      resendConfigured,
    };
  }

  if (restConfigured) {
    return {
      configured: true,
      transport: "cloudflare-rest",
      relayBound: false,
      restConfigured: true,
      resendConfigured,
      hint:
        "MAIL_RELAY is not bound — Pages REST fallback is active. Sync CLOUDFLARE_EMAIL_API_TOKEN (Email Sending → Edit), never the deploy token. Run: node website/admin/scripts/repair-mail.mjs",
    };
  }

  if (resendConfigured) {
    return {
      configured: true,
      transport: "resend",
      relayBound: false,
      restConfigured: false,
      resendConfigured: true,
    };
  }

  return {
    configured: false,
    transport: "none",
    relayBound: false,
    restConfigured: false,
    resendConfigured: false,
    hint:
      "Deploy ccm-mail-relay worker (CI does this automatically), or set CLOUDFLARE_EMAIL_API_TOKEN with Email Sending permission, or RESEND_API_KEY.",
  };
}

async function sendViaMailRelay(env, { to, subject, html, text, from, bcc, replyTo }) {
  const relay = env.MAIL_RELAY;
  if (!relay?.fetch) {
    return { sent: false, reason: "MAIL_RELAY service binding not configured" };
  }

  const res = await relay.fetch(
    new Request("https://internal/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, from, subject, html, text, bcc, replyTo }),
    })
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.sent === false) {
    return {
      sent: false,
      reason: payload.reason ?? `Mail relay HTTP ${res.status}`,
    };
  }

  return { sent: true, transport: payload.transport ?? "cloudflare-relay" };
}

async function sendViaCloudflareBinding(env, { to, subject, html, text, from, bcc, replyTo }) {
  const normalizedFrom = normalizeMailFromInput(from);
  await env.EMAIL.send({
    to: toWorkerRecipient(to),
    from: toWorkerFrom(normalizedFrom),
    subject,
    html,
    text,
    ...(bcc?.length ? { bcc: toWorkerRecipients(bcc) } : {}),
    ...(replyTo || normalizedFrom.replyTo
      ? { replyTo: toWorkerReplyTo(replyTo, normalizedFrom.replyTo) }
      : {}),
  });
  return { sent: true, transport: "cloudflare-binding" };
}

async function sendViaCloudflareRest(env, { to, subject, html, text, from, bcc, replyTo }) {
  const { accountId, token } = readCloudflareMailCredentials(env);
  if (!accountId || !token) {
    return { sent: false, reason: "Cloudflare Email REST credentials missing" };
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: toRestRecipients(to),
        from: toRestFrom(from),
        subject,
        html,
        text,
        reply_to: toRestReplyTo(replyTo, from.replyTo ?? from.email),
        ...(bcc?.length ? { bcc: toRestRecipients(bcc) } : {}),
      }),
    }
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors)
      ? payload.errors.map((e) => e.message || e.code).join("; ")
      : "";

    const sendingDisabled = Array.isArray(payload.errors)
      ? payload.errors.some((e) => e.code === 10203)
      : false;

    // If Resend API key is configured as a fallback, attempt sending via Resend
    if (typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim()) {
      const fallbackResult = await sendViaResend(env, { to, subject, html, text });
      if (fallbackResult.sent) {
        return {
          sent: true,
          transport: "resend-fallback",
          note: `Cloudflare Email failed (${res.status}: ${errors}); delivered via Resend fallback.`,
        };
      }
    }

    const authDiagnostic =
      res.status === 401
        ? " (REST token rejected — redeploy admin so ccm-mail-relay service binding is active, or set CLOUDFLARE_EMAIL_API_TOKEN with Email Sending → Edit)"
        : sendingDisabled
          ? " (Email Sending is disabled — upgrade to Workers Paid in Cloudflare → Email Service → Email Sending, then onboard lorapok.tech)"
          : res.status === 403
            ? " (Token may lack Email Sending permission)"
            : "";

    return {
      sent: false,
      reason: `Cloudflare Email ${res.status}: ${errors || JSON.stringify(payload).slice(0, 200)}${authDiagnostic}`,
    };
  }

  return { sent: true, transport: "cloudflare-rest" };
}

async function sendViaResend(env, { to, subject, html, text, from, bcc, replyTo }) {
  const resendKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!resendKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const resendFrom =
    typeof env.RESEND_FROM === "string" && env.RESEND_FROM.trim()
      ? env.RESEND_FROM.trim()
      : `${coerceMailDisplayName(from.name, "Cursor Curse Monitor")} <${from.email}>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo ?? from.email,
      ...(bcc?.length ? { bcc } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { sent: false, reason: `Resend ${res.status}: ${errText.slice(0, 200)}` };
  }

  return { sent: true, transport: "resend" };
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ to: string; subject: string; html: string; text?: string; category?: string; sentBy?: string | null }} opts
 * @returns {Promise<{ sent: boolean; transport?: string; reason?: string; mailboxId?: string }>}
 */
export async function sendMail(
  env,
  { to, subject, html, text, category = "system", sentBy = null, from: fromOverride = null, bcc: bccOverride = null }
) {
  const textBody = text ?? subject;
  const from = normalizeMailFromInput(fromOverride ?? resolveMailFrom(category));
  const bcc = bccOverride ?? defaultMailBcc();
  const payload = {
    to,
    subject,
    html,
    text: textBody,
    from,
    bcc,
    replyTo: from.replyTo ?? from.email,
  };

  let result = /** @type {{ sent: boolean; transport?: string; reason?: string }} */ ({ sent: false });

  if (env.MAIL_RELAY?.fetch) {
    try {
      result = await sendViaMailRelay(env, payload);
    } catch (err) {
      console.error("MAIL_RELAY failed", err);
      result = {
        sent: false,
        reason: err instanceof Error ? err.message : "Mail relay failed",
      };
    }
  }

  if (!result.sent && env.EMAIL?.send && !isVerifiedDestinationSandboxError(result.reason)) {
    try {
      result = await sendViaCloudflareBinding(env, payload);
    } catch (err) {
      console.error("EMAIL.send failed", err);
      result = {
        sent: false,
        reason: err instanceof Error ? err.message : "EMAIL binding failed",
      };
    }
  }

  if (!result.sent && isVerifiedDestinationSandboxError(result.reason) && resendConfigured(env)) {
    try {
      const resend = await sendViaResend(env, payload);
      if (resend.sent) result = resend;
    } catch (err) {
      console.error("Resend sandbox fallback error", err);
    }
  }

  if (!result.sent && !isVerifiedDestinationSandboxError(result.reason)) {
    try {
      const cf = await sendViaCloudflareRest(env, payload);
      if (cf.sent) result = cf;
      else if (!result.reason) result = cf;
    } catch (err) {
      console.error("Cloudflare Email REST error", err);
      if (!result.reason) {
        result = { sent: false, reason: err instanceof Error ? err.message : "Cloudflare Email REST failed" };
      }
    }

    if (!result.sent) {
      try {
        const resend = await sendViaResend(env, payload);
        if (resend.sent) result = resend;
        else if (!result.reason || result.reason.includes("credentials missing")) {
          result = resend;
        }
      } catch (err) {
        console.error("Resend error", err);
      }
    }
  }

  if (!result.sent) {
    const status = getMailTransportStatus(env);
    result = {
      sent: false,
      reason: formatOutboundMailFailure(result.reason ?? status.hint ?? "No outbound email transport configured"),
    };
  }

  let mailboxId;
  try {
    const recorded = await recordMailboxMessage(env, {
      direction: "outbound",
      from: from.email,
      to,
      subject,
      text: textBody,
      html,
      status: result.sent ? "sent" : "failed",
      category,
      sentBy,
      error: result.sent ? null : result.reason,
      read: false,
      meta: { bcc, copyTo: MAIL_OPS_COPY },
    });
    mailboxId = recorded.id;
  } catch (err) {
    console.error("recordMailboxMessage failed", err);
  }

  await logSystemEvent(env, {
    level: result.sent ? "info" : "error",
    source: "mail",
    message: result.sent ? `Email sent to ${to}` : `Email failed to ${to}`,
    email: sentBy,
    meta: { to, subject, category, transport: result.transport, reason: result.reason },
  });

  return { ...result, mailboxId };
}
