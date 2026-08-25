import {
  BUILTIN_NOTICES,
  CONVERSATION_RECOVERY_NOTICE,
  GENERATED_DEV_NOTICE,
  ROLLBACK_NOTICE,
  getNoticeTemplates,
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

export function mergeBuiltinNotices(items) {
  const next = [...items];
  let changed = false;
  for (const builtin of BUILTIN_NOTICES) {
    const index = next.findIndex((n) => n.id === builtin.id);
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

export async function ensureCatalogSeeded(env) {
  const catalog = await readCatalog(env);
  let items = [...catalog.items];
  const { items: mergedItems, changed: builtinsAdded } = mergeBuiltinNotices(items);
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
  await writeCatalog(env, next);
  return next;
}

/** Make the recovery notice public for a new release. */
export async function activateConversationRecoveryNotice(env) {
  const catalog = await ensureCatalogSeeded(env);
  const notice = { ...CONVERSATION_RECOVERY_NOTICE, updatedAt: new Date().toISOString(), enabled: true };
  const items = [notice, ...catalog.items.filter((item) => item.id !== notice.id)].map((item) => ({
    ...item,
    enabled: item.id === notice.id,
  }));
  await writeCatalog(env, { ...catalog, items });
  return publicNoticeShape(notice);
}

/** Make the recovery notice public after a rollback workflow has been accepted. */
export async function activateRollbackNotice(env) {
  const catalog = await ensureCatalogSeeded(env);
  const notice = { ...ROLLBACK_NOTICE, updatedAt: new Date().toISOString() };
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
