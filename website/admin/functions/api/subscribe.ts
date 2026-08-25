import { jsonResponse } from "./_shared/auth.js";
import { buildSubscribeHtml, sendMail } from "./_shared/mail.js";
import { CONSENT_VERSION, normalizeEmail, upsertSubscriber } from "./_shared/subscribers.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function normalizeInstallId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id.toLowerCase()
    : null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return jsonResponse({ error: "Valid email is required" }, 400, CORS_HEADERS);
  }

  if (body.probe === true) {
    return jsonResponse({ ok: true, probed: true, message: "Probe OK" }, 200, CORS_HEADERS);
  }

  if (body.consent !== true && body.consent !== "true") {
    return jsonResponse({ error: "Consent is required to subscribe" }, 400, CORS_HEADERS);
  }

  const upsert = await upsertSubscriber(env.ADMIN_KV, {
    email,
    source: String(body.source ?? "website").trim() || "website",
    installId: normalizeInstallId(body.installId ?? body.install_id),
    consentVersion: String(body.consentVersion ?? CONSENT_VERSION),
  });
  if (!upsert.ok) {
    return jsonResponse({ error: upsert.error || "Subscribe failed" }, 503, CORS_HEADERS);
  }

  const alreadySubscribed = Boolean(upsert.alreadySubscribed);
  const mailResult = await sendMail(env, {
    to: email,
    subject: "Subscribed to Cursor Curse Monitor updates",
    html: buildSubscribeHtml({ email }),
    text: `Thanks for subscribing, ${email}. We'll email you about important updates from Cursor Curse Monitor.`,
    category: "subscribe",
  });

  let message;
  if (mailResult.sent) {
    message = alreadySubscribed
      ? "You're already subscribed — we resent the confirmation email."
      : "You're subscribed! Check your inbox for a confirmation email.";
  } else if (alreadySubscribed) {
    message = "You're already on the list. We'll email you when there are updates.";
  } else {
    message =
      "You're on the list, but the welcome email could not be sent right now. We'll still notify you when outbound mail is restored.";
    console.error("subscribe welcome email failed", mailResult.reason);
  }

  return jsonResponse(
    {
      ok: true,
      emailed: mailResult.sent,
      alreadySubscribed,
      message,
      ...(mailResult.sent ? {} : { mailWarning: mailResult.reason }),
    },
    200,
    CORS_HEADERS
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
