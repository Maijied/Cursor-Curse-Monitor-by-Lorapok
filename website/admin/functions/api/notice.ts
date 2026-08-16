import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";

const NOTICE_KEY = "notice:active";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_NOTICE = {
  enabled: false,
  title: "",
  message: "",
  shortMessage: "",
  severity: "info",
  feedbackUrl: "",
  collaborateUrl: "",
  updatedAt: null,
  dismissible: true,
};

function normalizeNotice(body) {
  return {
    enabled: Boolean(body.enabled),
    title: String(body.title ?? "").trim(),
    message: String(body.message ?? "").trim(),
    shortMessage: String(body.shortMessage ?? body.short_message ?? "").trim(),
    severity: String(body.severity ?? "info").trim() || "info",
    feedbackUrl: String(body.feedbackUrl ?? body.feedback_url ?? "").trim(),
    collaborateUrl: String(body.collaborateUrl ?? body.collaborate_url ?? "").trim(),
    updatedAt: new Date().toISOString(),
    dismissible: body.dismissible !== false,
  };
}

async function readActiveNotice(env) {
  if (!env.ADMIN_KV?.get) return { ...DEFAULT_NOTICE };
  try {
    const raw = await env.ADMIN_KV.get(NOTICE_KEY);
    if (!raw) return { ...DEFAULT_NOTICE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NOTICE, ...parsed };
  } catch {
    return { ...DEFAULT_NOTICE };
  }
}

async function writeNoticeHistory(env, notice) {
  if (!env.ADMIN_KV?.get || !env.ADMIN_KV?.put) return;
  const day = new Date().toISOString().slice(0, 10);
  const historyKey = `notice:history:${day}`;
  try {
    const raw = await env.ADMIN_KV.get(historyKey);
    const list = raw ? JSON.parse(raw) : [];
    const entries = Array.isArray(list) ? list : [];
    entries.push(notice);
    await env.ADMIN_KV.put(historyKey, JSON.stringify(entries));
  } catch (err) {
    console.error("writeNoticeHistory failed", err);
  }
}

async function saveNotice(env, notice) {
  if (!env.ADMIN_KV?.put) {
    return jsonResponse({ error: "ADMIN_KV binding not configured" }, 503);
  }
  await env.ADMIN_KV.put(NOTICE_KEY, JSON.stringify(notice));
  await writeNoticeHistory(env, notice);
  return jsonResponse({ ok: true, notice });
}

export async function onRequestGet(context) {
  const { env } = context;
  const notice = await readActiveNotice(env);
  return jsonResponse(notice, 200, CORS_HEADERS);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const notice = normalizeNotice(body);
    return saveNotice(env, notice);
  } catch (err) {
    console.error("Notice POST error", err);
    return jsonResponse({ error: "Server error" }, 500);
  }
}

export async function onRequestPut(context) {
  return onRequestPost(context);
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const notice = { ...DEFAULT_NOTICE, updatedAt: new Date().toISOString() };
  return saveNotice(env, notice);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
