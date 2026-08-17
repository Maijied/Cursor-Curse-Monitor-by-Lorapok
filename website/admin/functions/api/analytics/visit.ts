import { jsonResponse } from "../_shared/auth.js";
import { ALLOWED_CHANNELS, incrementVisitorStats } from "../_shared/visitor-stats.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS);
  }

  const channel = typeof body.channel === "string" ? body.channel : "website";
  if (!ALLOWED_CHANNELS.has(channel)) {
    return jsonResponse({ error: "Invalid channel" }, 400, CORS);
  }

  if (!env.ADMIN_KV?.put) {
    return jsonResponse({ error: "ADMIN_KV binding not configured" }, 503, CORS);
  }

  try {
    const stats = await incrementVisitorStats(env, channel);
    return jsonResponse({ ok: true, channel, stats }, 200, CORS);
  } catch (err) {
    console.error("analytics visit", err);
    return jsonResponse({ error: "Server error" }, 500, CORS);
  }
}
