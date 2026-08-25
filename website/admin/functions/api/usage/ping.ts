import { jsonResponse } from "../_shared/auth.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const INSTALLS_PREFIX = "usage:install:";
const INSTALLS_INDEX_KEY = "usage:installs:index";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeInstallId(value) {
  const id = String(value ?? "").trim();
  if (!UUID_RE.test(id)) return null;
  return id.toLowerCase();
}

function normalizeOs(value) {
  const os = String(value ?? "").trim().toLowerCase().slice(0, 32);
  if (!os) return "unknown";
  return os;
}

function normalizeHost(value) {
  const host = String(value ?? "").trim().toLowerCase();
  if (host === "cursor" || host === "vscode" || host === "browser") return host;
  return "unknown";
}

function normalizeVersion(value) {
  return String(value ?? "").trim().slice(0, 32) || "unknown";
}

async function readIndex(env) {
  if (!env.ADMIN_KV?.get) return [];
  try {
    const raw = await env.ADMIN_KV.get(INSTALLS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(env, ids) {
  if (!env.ADMIN_KV?.put) return;
  // Cap index size to avoid unbounded growth; stats still key by install id.
  const trimmed = ids.slice(-50_000);
  await env.ADMIN_KV.put(INSTALLS_INDEX_KEY, JSON.stringify(trimmed));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, CORS_HEADERS);
  }

  const installId = normalizeInstallId(body?.installId);
  if (!installId) {
    return jsonResponse({ error: "installId must be a UUID" }, 400, CORS_HEADERS);
  }

  if (!env.ADMIN_KV?.put || !env.ADMIN_KV?.get) {
    return jsonResponse({ error: "ADMIN_KV binding not configured" }, 503, CORS_HEADERS);
  }

  const now = new Date().toISOString();
  const record = {
    installId,
    os: normalizeOs(body?.os),
    host: normalizeHost(body?.host),
    version: normalizeVersion(body?.version),
    lastSeenAt: now,
    firstSeenAt: now,
  };

  const key = `${INSTALLS_PREFIX}${installId}`;
  try {
    const existingRaw = await env.ADMIN_KV.get(key);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      record.firstSeenAt = existing.firstSeenAt || now;
    }
    await env.ADMIN_KV.put(key, JSON.stringify(record));

    const index = await readIndex(env);
    if (!index.includes(installId)) {
      index.push(installId);
      await writeIndex(env, index);
    }
  } catch (err) {
    console.error("usage ping failed", err);
    return jsonResponse({ error: "Server error" }, 500, CORS_HEADERS);
  }

  return jsonResponse({ ok: true }, 200, CORS_HEADERS);
}
