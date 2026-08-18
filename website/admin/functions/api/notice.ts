import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import {
  DEFAULT_NOTICE,
  activeFromCatalog,
  ensureCatalogSeeded,
  normalizeNotice,
  publicNoticeShape,
  setEnabled,
  writeCatalog,
} from "./_shared/notices.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const catalog = await ensureCatalogSeeded(env);
    return jsonResponse(publicNoticeShape(activeFromCatalog(catalog.items)), 200, CORS_HEADERS);
  } catch {
    return jsonResponse({ ...DEFAULT_NOTICE }, 200, CORS_HEADERS);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const catalog = await ensureCatalogSeeded(env);
    const notice = normalizeNotice({ ...body, enabled: body.enabled !== false });
    const items = catalog.items.map((n) => ({ ...n, enabled: false }));
    items.unshift(notice);
    await writeCatalog(env, { ...catalog, items });
    return jsonResponse({ ok: true, notice: publicNoticeShape(notice), items });
  } catch (err) {
    console.error("Notice POST error", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
}

export async function onRequestPut(context) {
  return onRequestPost(context);
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const catalog = await ensureCatalogSeeded(env);
    const items = setEnabled(
      catalog.items,
      catalog.items.find((n) => n.enabled)?.id,
      false
    );
    await writeCatalog(env, { ...catalog, items });
    return jsonResponse({ ok: true, notice: { ...DEFAULT_NOTICE, updatedAt: new Date().toISOString() }, items });
  } catch (err) {
    console.error("Notice DELETE error", err);
    return jsonResponse({ error: "Server error" }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
