const FROM_EMAIL = "cursor-contact@lorapok.tech";
const FROM_NAME = "Cursor Curse Monitor";
const DEFAULT_ADMIN_URL = "https://cursor-dev.lorapok.tech";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#0b0f1a 0%,#1a1033 50%,#0d1b2a 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:rgba(15,23,42,0.92);border:1px solid rgba(99,102,241,0.35);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4,#6366f1);background-size:300% 100%;"></td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;color:#e2e8f0;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#a5b4fc;">Lorapok Labs</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#f8fafc;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;color:#cbd5e1;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;color:#64748b;font-size:12px;line-height:1.5;">
              Sent from ${FROM_EMAIL} · Cursor Curse Monitor by Lorapok
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
  const safeUrl = escapeHtml(inviteUrl);
  const invitedByLine = invitedBy
    ? `Invited by <strong style="color:#e2e8f0;">${escapeHtml(invitedBy)}</strong>.`
    : "Use your Google account or email magic link to sign in.";
  const body = `
    <p style="margin:0 0 16px;">You've been invited to the Cursor Curse Monitor admin dashboard.</p>
    <p style="margin:0 0 20px;color:#94a3b8;">${invitedByLine}</p>
    <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;">Open admin dashboard</a>
  `;
  return emailShell("Admin invitation", body);
}

export function buildSubscribeHtml({ email }) {
  const safeEmail = escapeHtml(email);
  const body = `
    <p style="margin:0 0 16px;">Thanks for subscribing to Cursor Curse Monitor updates.</p>
    <p style="margin:0 0 12px;color:#94a3b8;">We'll email <strong style="color:#e2e8f0;">${safeEmail}</strong> when there are important release or notice updates.</p>
    <p style="margin:0;color:#94a3b8;">You can unsubscribe any time by replying to this message.</p>
  `;
  return emailShell("You're subscribed", body);
}

export function buildNoticeHtml({ title, message, severity, feedbackUrl }) {
  const severityColor =
    severity === "critical" ? "#f87171" : severity === "warning" ? "#fbbf24" : "#60a5fa";
  const safeTitle = escapeHtml(title || "Development notice");
  const safeMessage = escapeHtml(message ?? "");
  const feedbackLink = feedbackUrl
    ? `<a href="${escapeHtml(feedbackUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;border:1px solid rgba(99,102,241,0.5);color:#c7d2fe;text-decoration:none;">Send feedback</a>`
    : "";
  const body = `
    <p style="margin:0 0 12px;padding:8px 12px;border-radius:8px;background:rgba(99,102,241,0.12);border-left:3px solid ${severityColor};color:#e2e8f0;font-weight:600;">${safeTitle}</p>
    <p style="margin:0 0 20px;white-space:pre-wrap;">${safeMessage}</p>
    ${feedbackLink}
  `;
  return emailShell(title || "Development notice", body);
}

function readCloudflareMailCredentials(env) {
  const accountId =
    typeof env.CLOUDFLARE_ACCOUNT_ID === "string" ? env.CLOUDFLARE_ACCOUNT_ID.trim() : "";
  const token =
    (typeof env.CLOUDFLARE_EMAIL_API_TOKEN === "string" ? env.CLOUDFLARE_EMAIL_API_TOKEN : "") ||
    (typeof env.CLOUDFLARE_API_TOKEN === "string" ? env.CLOUDFLARE_API_TOKEN : "");
  return { accountId, token: token.trim() };
}

/**
 * @param {Record<string, unknown>} env
 */
export function getMailTransportStatus(env) {
  if (env.EMAIL?.send) {
    return { configured: true, transport: "cloudflare-binding" };
  }

  const { accountId, token } = readCloudflareMailCredentials(env);
  if (accountId && token) {
    return { configured: true, transport: "cloudflare-rest" };
  }

  if (typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim()) {
    return { configured: true, transport: "resend" };
  }

  return {
    configured: false,
    transport: "none",
    hint:
      "Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_EMAIL_API_TOKEN (Pages secret), or RESEND_API_KEY. Enable Email Sending for lorapok.tech.",
  };
}

async function sendViaCloudflareBinding(env, { to, subject, html, text }) {
  await env.EMAIL.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    html,
    text,
  });
  return { sent: true, transport: "cloudflare-binding" };
}

async function sendViaCloudflareRest(env, { to, subject, html, text }) {
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
        to,
        from: { address: FROM_EMAIL, name: FROM_NAME },
        subject,
        html,
        text,
        reply_to: FROM_EMAIL,
      }),
    }
  );

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors)
      ? payload.errors.map((e) => e.message || e.code).join("; ")
      : "";
    return {
      sent: false,
      reason: `Cloudflare Email ${res.status}: ${errors || JSON.stringify(payload).slice(0, 200)}`,
    };
  }

  return { sent: true, transport: "cloudflare-rest" };
}

async function sendViaResend(env, { to, subject, html, text }) {
  const resendKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.trim() : "";
  if (!resendKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
      text,
      reply_to: FROM_EMAIL,
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
 * @param {{ to: string; subject: string; html: string; text?: string }} opts
 * @returns {Promise<{ sent: boolean; transport?: string; reason?: string }>}
 */
export async function sendMail(env, { to, subject, html, text }) {
  const textBody = text ?? subject;
  const payload = { to, subject, html, text: textBody };

  if (env.EMAIL?.send) {
    try {
      return await sendViaCloudflareBinding(env, payload);
    } catch (err) {
      console.error("EMAIL.send failed", err);
      return {
        sent: false,
        reason: err instanceof Error ? err.message : "EMAIL binding failed",
      };
    }
  }

  try {
    const cf = await sendViaCloudflareRest(env, payload);
    if (cf.sent) return cf;
    if (cf.reason && !cf.reason.includes("credentials missing")) {
      console.error("Cloudflare Email REST failed", cf.reason);
    }
  } catch (err) {
    console.error("Cloudflare Email REST error", err);
  }

  try {
    const resend = await sendViaResend(env, payload);
    if (resend.sent) return resend;
    if (resend.reason && !resend.reason.includes("not configured")) {
      console.error("Resend failed", resend.reason);
    }
  } catch (err) {
    console.error("Resend error", err);
  }

  const status = getMailTransportStatus(env);
  return {
    sent: false,
    reason: status.hint ?? "No outbound email transport configured",
  };
}
