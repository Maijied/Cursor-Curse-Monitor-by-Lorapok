import { jsonResponse, verifyAdminRequest, requirePermission } from "../_shared/auth.js";

const CONFIG_KEY = "community:config";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_CONFIG = {
  featuredDiscussionUrls: [],
  defaultCategorySlug: "announcements",
  issueTopicLabelMap: {},
  collaborateUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/discussions",
  updatedAt: null,
  updatedBy: null,
};

async function readConfig(env) {
  if (!env.ADMIN_KV?.get) return { ...DEFAULT_CONFIG };
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { env } = context;
  const config = await readConfig(env);
  return jsonResponse(config, 200, CORS_HEADERS);
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;
  const readDenied = requirePermission(auth, "integrations.read");
  if (readDenied) return readDenied;
  const denied = requirePermission(auth, "integrations.write");
  if (denied) return denied;
  if (!env.ADMIN_KV?.put) {
    return jsonResponse({ error: "ADMIN_KV binding not configured" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const current = await readConfig(env);
  const next = {
    ...current,
    featuredDiscussionUrls: Array.isArray(body.featuredDiscussionUrls)
      ? body.featuredDiscussionUrls.map(String).filter(Boolean).slice(0, 20)
      : current.featuredDiscussionUrls,
    defaultCategorySlug: String(body.defaultCategorySlug ?? current.defaultCategorySlug).slice(0, 64),
    issueTopicLabelMap:
      body.issueTopicLabelMap && typeof body.issueTopicLabelMap === "object"
        ? body.issueTopicLabelMap
        : current.issueTopicLabelMap,
    collaborateUrl: String(body.collaborateUrl ?? current.collaborateUrl).slice(0, 512),
    updatedAt: new Date().toISOString(),
    updatedBy: auth.email,
  };

  await env.ADMIN_KV.put(CONFIG_KEY, JSON.stringify(next));
  return jsonResponse({ ok: true, config: next });
}
