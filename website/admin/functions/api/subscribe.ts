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

  const subscribers = await readSubscribers(env);
  if (!subscribers.includes(email)) {
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
    text: `Thanks for subscribing, ${email}. We'll email you about important updates.`,
  });

  return jsonResponse({ ok: true, emailed: mailResult.sent }, 200, CORS_HEADERS);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
