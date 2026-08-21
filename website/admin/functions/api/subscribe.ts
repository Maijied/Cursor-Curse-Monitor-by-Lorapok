import { jsonResponse } from "./_shared/auth.js";
import { buildSubscribeHtml, sendMail } from "./_shared/mail.js";

const SUBSCRIBERS_KEY = "subscribers";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function readSubscribers(env) {
  if (!env.ADMIN_KV?.get) return [];
  try {
    const raw = await env.ADMIN_KV.get(SUBSCRIBERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((e) => String(e).toLowerCase()) : [];
  } catch {
    return [];
  }
}

async function writeSubscribers(env, emails) {
  if (!env.ADMIN_KV?.put) return false;
  const unique = [...new Set(emails.map((e) => String(e).toLowerCase()).filter(Boolean))].sort();
  await env.ADMIN_KV.put(SUBSCRIBERS_KEY, JSON.stringify(unique));
  return true;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: "Valid email is required" }, 400, CORS_HEADERS);
  }

  // Health / Catalog diagnostic probe - return success without side effects
  if (body.probe === true) {
    return jsonResponse({ ok: true, probed: true, message: "Probe OK" }, 200, CORS_HEADERS);
  }

  const subscribers = await readSubscribers(env);
  const alreadySubscribed = subscribers.includes(email);
  if (!alreadySubscribed) {
    subscribers.push(email);
    const stored = await writeSubscribers(env, subscribers);
    if (!stored) {
      return jsonResponse({ error: "Subscriber storage unavailable" }, 503, CORS_HEADERS);
    }
  }

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
