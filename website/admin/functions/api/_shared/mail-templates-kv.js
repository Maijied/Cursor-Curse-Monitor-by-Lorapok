import { putKvJsonIfChanged } from "./kv-put.js";

const CONFIG_KEY = "integrations:mail-templates";

/**
 * @typedef {Object} MailTemplateOverride
 * @property {string} [subject]
 * @property {string} [text]
 * @property {boolean} [enabled]
 */

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeMailTemplateOverrides(parsed) {
  const raw = parsed?.overrides && typeof parsed.overrides === "object" ? parsed.overrides : parsed;
  if (!raw || typeof raw !== "object") return { overrides: {} };

  /** @type {Record<string, MailTemplateOverride>} */
  const overrides = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    /** @type {MailTemplateOverride} */
    const entry = {};
    if (typeof value.subject === "string" && value.subject.trim()) entry.subject = value.subject.trim();
    if (typeof value.text === "string" && value.text.trim()) entry.text = value.text.trim();
    if (typeof value.enabled === "boolean") entry.enabled = value.enabled;
    if (Object.keys(entry).length) overrides[id] = entry;
  }
  return { overrides };
}

/** @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv */
export async function readMailTemplateOverrides(kv) {
  if (!kv?.get) return { overrides: {} };
  try {
    const raw = await kv.get(CONFIG_KEY);
    if (!raw) return { overrides: {} };
    return normalizeMailTemplateOverrides(JSON.parse(raw));
  } catch {
    return { overrides: {} };
  }
}

/**
 * @param {import("@cloudflare/workers-types").KVNamespace | undefined} kv
 * @param {Record<string, MailTemplateOverride>} overrides
 */
export async function writeMailTemplateOverrides(kv, overrides) {
  if (!kv?.put) return { ok: false, error: "KV unavailable" };
  const normalized = normalizeMailTemplateOverrides({ overrides });
  await putKvJsonIfChanged(kv, CONFIG_KEY, normalized);
  return { ok: true, config: normalized };
}

/**
 * Apply KV overrides onto a catalog template row.
 * @param {Record<string, unknown>} template
 * @param {Record<string, MailTemplateOverride>} overrides
 */
export function applyMailTemplateOverride(template, overrides) {
  const override = overrides[template.id];
  if (!override) return { ...template, source: "catalog" };
  if (override.enabled === false) return null;
  return {
    ...template,
    subject: override.subject ?? template.subject,
    text: override.text ?? template.text,
    source: override.subject || override.text ? "kv-override" : "catalog",
  };
}
