const FROM_EMAIL = "cursor-contact@lorapok.tech";
const FROM_NAME = "Cursor Curse Monitor";

function emailShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#0b0f1a 0%,#1a1033 50%,#0d1b2a 100%);padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:rgba(15,23,42,0.92);border:1px solid rgba(99,102,241,0.35);border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4,#6366f1);background-size:300% 100%;animation:gradientShift 6s ease infinite;"></td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;color:#e2e8f0;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#a5b4fc;">Lorapok Labs</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#f8fafc;">${title}</h1>
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
  <style>
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  </style>
</body>
</html>`;
}

export function buildInviteHtml({ inviteUrl, invitedBy }) {
  const body = `
    <p style="margin:0 0 16px;">You've been invited to the Cursor Curse Monitor admin dashboard.</p>
    <p style="margin:0 0 20px;color:#94a3b8;">${invitedBy ? `Invited by <strong style="color:#e2e8f0;">${invitedBy}</strong>.` : "Use your Google account to sign in."}</p>
    <a href="${inviteUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;">Open admin dashboard</a>
  `;
  return emailShell("Admin invitation", body);
}

export function buildSubscribeHtml({ email }) {
  const body = `
    <p style="margin:0 0 16px;">Thanks for subscribing to Cursor Curse Monitor updates.</p>
    <p style="margin:0 0 12px;color:#94a3b8;">We'll email <strong style="color:#e2e8f0;">${email}</strong> when there are important release or notice updates.</p>
    <p style="margin:0;color:#94a3b8;">You can unsubscribe any time by replying to this message.</p>
  `;
  return emailShell("You're subscribed", body);
}

export function buildNoticeHtml({ title, message, severity, feedbackUrl }) {
  const severityColor =
    severity === "critical" ? "#f87171" : severity === "warning" ? "#fbbf24" : "#60a5fa";
  const body = `
    <p style="margin:0 0 12px;padding:8px 12px;border-radius:8px;background:rgba(99,102,241,0.12);border-left:3px solid ${severityColor};color:#e2e8f0;font-weight:600;">${title}</p>
    <p style="margin:0 0 20px;white-space:pre-wrap;">${message}</p>
    ${feedbackUrl ? `<a href="${feedbackUrl}" style="display:inline-block;padding:10px 18px;border-radius:10px;border:1px solid rgba(99,102,241,0.5);color:#c7d2fe;text-decoration:none;">Send feedback</a>` : ""}
  `;
  return emailShell(title || "Development notice", body);
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ to: string; subject: string; html: string; text?: string }} opts
 * @returns {Promise<{ sent: boolean; reason?: string }>}
 */
export async function sendMail(env, { to, subject, html, text }) {
  const textBody = text ?? subject;

  if (env.EMAIL?.send) {
    try {
      await env.EMAIL.send({
        to,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        html,
        text: textBody,
      });
      return { sent: true };
    } catch (err) {
      console.error("EMAIL.send failed", err);
      return { sent: false, reason: err instanceof Error ? err.message : "EMAIL binding failed" };
    }
  }

  const resendKey = typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY : "";
  if (resendKey) {
    try {
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
          text: textBody,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { sent: false, reason: `Resend ${res.status}: ${errText.slice(0, 200)}` };
      }
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : "Resend failed" };
    }
  }

  return {
    sent: false,
    reason:
      "No email binding configured. Enable Cloudflare Email Sending for lorapok.tech or set RESEND_API_KEY Pages secret.",
  };
}
