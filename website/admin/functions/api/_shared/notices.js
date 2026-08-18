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

/** Generated marketing-site notice from generate-site-data.mjs — imported into the admin catalog once. */
export const GENERATED_DEV_NOTICE = {
  id: "generated-dev-notice",
  source: "generated",
  enabled: true,
  type: "development",
  severity: "warning",
  title: "Active Development Notice",
  message:
    "Cursor Curse Monitor is still in active development. Some users may experience conflicts with their Cursor database — we are deeply sorry, especially to Lorapok Labs members and everyone affected. A stable release is targeted soon (expected by tomorrow). Thank you for your support — your feedback helps us improve. Interested in collaborating on Lorapok Labs projects? You're welcome to reach out.",
  shortMessage:
    "Still in development — some users may see Cursor database conflicts. Stable release coming soon. We apologize to everyone affected.",
  feedbackUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues",
  collaborateUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/discussions",
  updatedAt: "2026-08-15T00:00:00.000Z",
  dismissible: true,
};

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
  if (catalog.seeded) return catalog;

  const items = [...catalog.items];
  const hasGenerated = items.some((n) => n.id === GENERATED_DEV_NOTICE.id);
  if (!hasGenerated) {
    items.push({ ...GENERATED_DEV_NOTICE });
  }

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
      }
    }
  } catch {
    // ignore migrate failures
  }

  const next = { seeded: true, items };
  await writeCatalog(env, next);
  return next;
}

export function setEnabled(items, id, enabled) {
  return items.map((n) => ({
    ...n,
    enabled: enabled ? n.id === id : n.id === id ? false : n.enabled,
    updatedAt: n.id === id ? new Date().toISOString() : n.updatedAt,
  }));
}
