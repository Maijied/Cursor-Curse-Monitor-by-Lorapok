import { jsonResponse, verifyAdminRequest } from "./_shared/auth.js";
import {
  DEFAULT_NOTICE,
  activeFromCatalog,
  ensureCatalogSeeded,
  getNoticeTemplates,
  normalizeNotice,
  publicNoticeShape,
  setEnabled,
  writeCatalog,
} from "./_shared/notices.js";

/**
 * Retrieves notice templates or the current public notice catalog.
 *
 * @param context - The request context containing the request and environment bindings.
 * @returns A response containing either notice templates or public-formatted notices and the active notice.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const templatesMode = url.searchParams.get("templates") === "1";

  try {
    if (templatesMode) {
      const templates = await getNoticeTemplates(env);
      return jsonResponse({ templates });
    }

    const catalog = await ensureCatalogSeeded(env);
    return jsonResponse({
      items: catalog.items.map(publicNoticeShape),
      active: publicNoticeShape(activeFromCatalog(catalog.items)),
    });
  } catch (err) {
    console.error("notices GET", err);
    return jsonResponse({ error: "Failed to load notices" }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const catalog = await ensureCatalogSeeded(env);
    const notice = normalizeNotice({ ...body, enabled: Boolean(body.enabled) });
    let items = catalog.items;
    if (notice.enabled) {
      items = items.map((n) => ({ ...n, enabled: false }));
    }
    items = [notice, ...items];
    await writeCatalog(env, { ...catalog, items });
    return jsonResponse({ ok: true, notice: publicNoticeShape(notice), items: items.map(publicNoticeShape) });
  } catch (err) {
    console.error("notices POST", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const id = String(body.id ?? "").trim();
    if (!id) return jsonResponse({ error: "id is required" }, 400);

    const catalog = await ensureCatalogSeeded(env);
    let items = [...catalog.items];
    const index = items.findIndex((n) => n.id === id);

    if (index < 0) {
      const notice = normalizeNotice(
        { ...body, id },
        { id, source: body.source ?? "admin" }
      );
      if (notice.enabled) {
        items = items.map((n) => ({ ...n, enabled: false }));
      }
      items = [notice, ...items];
      await writeCatalog(env, { ...catalog, items });
      return jsonResponse({
        ok: true,
        notice: publicNoticeShape(notice),
        items: items.map(publicNoticeShape),
      });
    }

    if (typeof body.enabled === "boolean" && Object.keys(body).every((k) => ["id", "enabled"].includes(k))) {
      items = setEnabled(items, id, body.enabled);
    } else {
      const merged = normalizeNotice({ ...items[index], ...body, id }, { id, source: items[index].source });
      items[index] = merged;
      if (merged.enabled) {
        items = items.map((n) => (n.id === id ? n : { ...n, enabled: false }));
      }
    }
    await writeCatalog(env, { ...catalog, items });
    return jsonResponse({
      ok: true,
      notice: publicNoticeShape(items.find((n) => n.id === id)),
      items: items.map(publicNoticeShape),
    });
  } catch (err) {
    console.error("notices PUT", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Server error" }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = await verifyAdminRequest(request, env);
  if (auth.error) return auth.error;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return jsonResponse({ error: "id is required" }, 400);

  try {
    const catalog = await ensureCatalogSeeded(env);
    const items = catalog.items.filter((n) => n.id !== id);
    if (items.length === catalog.items.length) {
      return jsonResponse({ error: "Notice not found" }, 404);
    }
    await writeCatalog(env, { ...catalog, items });
    return jsonResponse({
      ok: true,
      notice: publicNoticeShape(activeFromCatalog(items)),
      items: items.map(publicNoticeShape),
    });
  } catch (err) {
    console.error("notices DELETE", err);
    return jsonResponse({ error: "Server error" }, 500);
  }
}

export { DEFAULT_NOTICE };
