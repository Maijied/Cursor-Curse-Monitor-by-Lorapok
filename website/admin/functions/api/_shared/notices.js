import {
  BUILTIN_NOTICES,
  CONVERSATION_RECOVERY_NOTICE,
  GENERATED_DEV_NOTICE,
  ROLLBACK_NOTICE,
  getConversationRecoveryNotice,
  getHydratedBuiltinNotices,
  getNoticeTemplates,
  getRollbackNotice,
} from "./notice-catalog.js";

const CATALOG_KEY = "notice:catalog";
const ACTIVE_KEY = "notice:active";

export const DEFAULT_NOTICE = {
  enabled: false,
  title: "",
  message: "",
  shortMessage: "",
  severity: "info",
  feedbackUrl: "",
  collaborateUrl: "",
  updatedAt: null,
  dismissible: true,
  type: "development",
};

export { GENERATED_DEV_NOTICE, CONVERSATION_RECOVERY_NOTICE, ROLLBACK_NOTICE, getNoticeTemplates };

/**
 * Merges built-in notices into a notice collection and refreshes matching generated notices.
 * @param {Array} items - The existing notices.
 * @param {Object} [env] - Optional environment used to load hydrated built-in notices.
 * @return {{items: Array, changed: boolean}} The merged notices and whether the collection changed.
 */
function sanitizeCatalogItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item === "object");
}

export async function mergeBuiltinNotices(items, env) {
  let builtins = BUILTIN_NOTICES;
  if (env) {
    try {
      builtins = await getHydratedBuiltinNotices(env);
    } catch (error) {
      console.warn("mergeBuiltinNotices: hydration failed — using embedded builtins", error);
      builtins = BUILTIN_NOTICES;
    }
  }
  if (!Array.isArray(builtins)) {
    console.warn("mergeBuiltinNotices: hydrated builtins is not an array — using embedded snapshot");
    builtins = BUILTIN_NOTICES;
  }
  const next = sanitizeCatalogItems(items);
  let changed = next.length !== (Array.isArray(items) ? items.length : 0);
  for (const builtin of builtins) {
    if (!builtin?.id) continue;
    const index = next.findIndex((n) => n?.id === builtin.id);
    if (index < 0) {
      next.push({ ...builtin });
      changed = true;
      continue;
    }
    if (builtin.source === "generated" && next[index].source === "generated") {
      const refreshFields = [
        "title",
        "message",
        "shortMessage",
        "severity",
        "feedbackUrl",
        "collaborateUrl",
      ];
      const differs = refreshFields.some((field) => next[index][field] !== builtin[field]);
      if (differs) {
        next[index] = {
          ...next[index],
          title: builtin.title,
          message: builtin.message,
          shortMessage: builtin.shortMessage,
          severity: builtin.severity,
          feedbackUrl: builtin.feedbackUrl,
          collaborateUrl: builtin.collaborateUrl,
          updatedAt: builtin.updatedAt ?? new Date().toISOString(),
        };
        changed = true;
      }
    }
  }
  return { items: next, changed };
}

export function normalizeNotice(body, extras = {}) {
  return {
    enabled: Boolean(body.enabled),
    type: String(body.type ?? "development").trim() || "development",
    title: String(body.title ?? "").trim(),
    message: String(body.message ?? "").trim(),
    shortMessage: String(body.shortMessage ?? body.short_message ?? "").trim(),
    severity: String(body.severity ?? "info").trim() || "info",
    feedbackUrl: String(body.feedbackUrl ?? body.feedback_url ?? "").trim(),
    collaborateUrl: String(body.collaborateUrl ?? body.collaborate_url ?? "").trim(),
    updatedAt: extras.updatedAt ?? new Date().toISOString(),
    dismissible: body.dismissible !== false,
    id: extras.id ?? body.id ?? crypto.randomUUID(),
    source: extras.source ?? body.source ?? "admin",
  };
}

export function publicNoticeShape(notice) {
  if (!notice) return { ...DEFAULT_NOTICE };
  return {
    enabled: Boolean(notice.enabled),
    type: notice.type ?? "development",
    title: notice.title ?? "",
    message: notice.message ?? "",
    shortMessage: notice.shortMessage ?? "",
    severity: notice.severity ?? "info",
    feedbackUrl: notice.feedbackUrl ?? "",
    collaborateUrl: notice.collaborateUrl ?? "",
    updatedAt: notice.updatedAt ?? null,
    dismissible: notice.dismissible !== false,
    id: notice.id ?? null,
    source: notice.source ?? "admin",
  };
}

export function activeFromCatalog(items) {
  return items.find((n) => n.enabled) ?? { ...DEFAULT_NOTICE };
}

function emptyCatalog() {
  return { seeded: false, items: [] };
}

export async function readCatalog(env) {
  if (!env.ADMIN_KV?.get) return emptyCatalog();
  try {
    const raw = await env.ADMIN_KV.get(CATALOG_KEY);
    if (!raw) return emptyCatalog();
    const parsed = JSON.parse(raw);
    return {
      seeded: Boolean(parsed.seeded),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return emptyCatalog();
  }
}

export async function writeCatalog(env, catalog) {
  if (!env.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  await env.ADMIN_KV.put(CATALOG_KEY, JSON.stringify(catalog));
  const active = publicNoticeShape(activeFromCatalog(catalog.items));
  await env.ADMIN_KV.put(ACTIVE_KEY, JSON.stringify(active));
  return catalog;
}

/**
 * Ensures the notice catalog contains built-in notices and is marked as seeded.
 *
 * Migrates a legacy active notice when needed and persists changes. If the storage
 * binding is unavailable, returns the updated catalog without marking it as seeded.
 *
 * @return {{seeded: boolean, items: Array}} The seeded catalog, or a read-only catalog when storage is unavailable.
 */
export async function ensureCatalogSeeded(env) {
  const catalog = await readCatalog(env);
  let items = sanitizeCatalogItems(catalog.items);
  let mergedItems = items;
  let builtinsAdded = false;
  try {
    const merged = await mergeBuiltinNotices(items, env);
    mergedItems = merged.items;
    builtinsAdded = merged.changed;
  } catch (error) {
    console.warn("ensureCatalogSeeded: mergeBuiltinNotices failed — using sanitized catalog", error);
  }
  items = mergedItems;
  let changed = builtinsAdded || !catalog.seeded;

  if (!catalog.seeded) {
    try {
      const raw = await env.ADMIN_KV?.get?.(ACTIVE_KEY);
      if (raw) {
        const active = JSON.parse(raw);
        if (active?.title && !items.some((n) => n.title === active.title && n.source === "admin")) {
          items.push(
            normalizeNotice(active, {
              id: active.id || crypto.randomUUID(),
              source: "admin",
              updatedAt: active.updatedAt || new Date().toISOString(),
            })
          );
          changed = true;
        }
      }
    } catch {
      // ignore migrate failures
    }
  }

  if (!changed) {
    return { ...catalog, items };
  }

  const next = { seeded: true, items };
  try {
    await writeCatalog(env, next);
    return next;
  } catch (error) {
    console.warn("ensureCatalogSeeded: persist failed — returning in-memory catalog", error);
    return { seeded: catalog.seeded, items };
  }
}

/**
 * Activates the conversation recovery notice and persists it as the sole enabled notice.
 * @returns {Object} The public representation of the activated notice.
 */
export async function activateConversationRecoveryNotice(env) {
  const catalog = await ensureCatalogSeeded(env);
  const recovery = await getConversationRecoveryNotice(env);
  const notice = { ...recovery, updatedAt: new Date().toISOString(), enabled: true };
  const items = [notice, ...catalog.items.filter((item) => item.id !== notice.id)].map((item) => ({
    ...item,
    enabled: item.id === notice.id,
  }));
  await writeCatalog(env, { ...catalog, items });
  return publicNoticeShape(notice);
}

/**
 * Activates the rollback notice and disables all other notices.
 * @returns {Object} The public representation of the activated rollback notice.
 */
export async function activateRollbackNotice(env) {
  const catalog = await ensureCatalogSeeded(env);
  const rollback = await getRollbackNotice(env);
  const notice = { ...rollback, updatedAt: new Date().toISOString() };
  const items = [notice, ...catalog.items.filter((item) => item.id !== notice.id)].map((item) => ({
    ...item,
    enabled: item.id === notice.id,
  }));
  await writeCatalog(env, { ...catalog, items });
  return publicNoticeShape(notice);
}

export function setEnabled(items, id, enabled) {
  return items.map((n) => ({
    ...n,
    enabled: enabled ? n.id === id : n.id === id ? false : n.enabled,
    updatedAt: n.id === id ? new Date().toISOString() : n.updatedAt,
  }));
}
