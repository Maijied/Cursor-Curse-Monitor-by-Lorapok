import { putKvJsonIfChanged } from "./kv-put.js";
import {
  FROM_NAME_HELP,
  FROM_NAME_MONITOR,
  MAIL_HELP,
  MAIL_MONITOR,
  MAIL_OPS_COPY,
} from "./mail-addresses.js";

export const IDENTITY_DOMAIN = "lorapok.tech";
export const CONFIG_KEY = "integrations:email-identities";

export const IDENTITY_CATEGORIES = ["product", "support", "ops", "custom"];

const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;

export const RESERVED_LOCAL_PARTS = new Set([
  "admin",
  "postmaster",
  "abuse",
  "noreply",
  "no-reply",
  "mailer-daemon",
  "hostmaster",
  "webmaster",
]);

/** @type {import("./email-identities-config.js").EmailIdentity[]} */
export const BUILTIN_IDENTITIES = [
  {
    id: "cursor.monitor",
    localPart: "cursor.monitor",
    displayName: FROM_NAME_MONITOR,
    category: "product",
    forwardTo: MAIL_OPS_COPY,
    enabled: true,
    routingStatus: "builtin",
    cloudflareRuleId: null,
    provisionedAt: null,
  },
  {
    id: "cursor.curse.help",
    localPart: "cursor.curse.help",
    displayName: FROM_NAME_HELP,
    category: "support",
    forwardTo: MAIL_OPS_COPY,
    enabled: true,
    routingStatus: "builtin",
    cloudflareRuleId: null,
    provisionedAt: null,
  },
  {
    id: "admin",
    localPart: "admin",
    displayName: "Mission Control Admin",
    category: "ops",
    forwardTo: MAIL_OPS_COPY,
    enabled: true,
    routingStatus: "builtin",
    cloudflareRuleId: null,
    provisionedAt: null,
  },
];

/**
 * @param {string} localPart
 */
export function validateIdentityLocalPart(localPart) {
  const value = String(localPart ?? "").trim().toLowerCase();
  if (!value) return { ok: false, error: "Local part is required" };
  if (value.length > 64) return { ok: false, error: "Local part must be 64 characters or fewer" };
  if (!LOCAL_PART_RE.test(value)) {
    return { ok: false, error: "Use lowercase letters, numbers, dots, and hyphens only" };
  }
  if (value.includes("..")) {
    return { ok: false, error: "Local part cannot contain consecutive dots" };
  }
  if (RESERVED_LOCAL_PARTS.has(value)) {
    return { ok: false, error: `"${value}" is reserved` };
  }
  return { ok: true, value };
}

/**
 * @param {string} localPart
 * @param {string} [domain]
 */
export function identityEmail(localPart, domain = IDENTITY_DOMAIN) {
  return `${String(localPart).trim().toLowerCase()}@${domain}`;
}

/**
 * @param {unknown} raw
 */
function normalizeIdentity(raw) {
  const localPart = String(raw?.localPart ?? raw?.id ?? "").trim().toLowerCase();
  const check = validateIdentityLocalPart(localPart);
  if (!check.ok && !BUILTIN_IDENTITIES.some((b) => b.localPart === localPart)) {
    return null;
  }
  const category = IDENTITY_CATEGORIES.includes(String(raw?.category ?? "").toLowerCase())
    ? String(raw.category).toLowerCase()
    : "custom";
  const forwardTo = String(raw?.forwardTo ?? MAIL_OPS_COPY).trim().toLowerCase();
  return {
    id: localPart,
    localPart,
    displayName: String(raw?.displayName ?? localPart).trim().slice(0, 80) || localPart,
    category,
    forwardTo,
    enabled: raw?.enabled !== false,
    routingStatus: String(raw?.routingStatus ?? "pending"),
    cloudflareRuleId: raw?.cloudflareRuleId ? String(raw.cloudflareRuleId) : null,
    provisionedAt: raw?.provisionedAt ? String(raw.provisionedAt) : null,
  };
}

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeEmailIdentitiesConfig(parsed) {
  const domain = String(parsed?.domain ?? IDENTITY_DOMAIN).trim().toLowerCase();
  const opsForwardTo = String(parsed?.opsForwardTo ?? MAIL_OPS_COPY).trim().toLowerCase();
  const rawList = Array.isArray(parsed?.identities) ? parsed.identities : [];
  const merged = new Map(BUILTIN_IDENTITIES.map((item) => [item.localPart, { ...item }]));

  for (const entry of rawList) {
    const normalized = normalizeIdentity(entry);
    if (!normalized) continue;
    const existing = merged.get(normalized.localPart) ?? {};
    merged.set(normalized.localPart, { ...existing, ...normalized });
  }

  return {
    domain,
    opsForwardTo,
    identities: [...merged.values()].sort((a, b) => a.localPart.localeCompare(b.localPart)),
    updatedAt: parsed?.updatedAt ?? null,
    updatedBy: parsed?.updatedBy ?? null,
  };
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readEmailIdentitiesConfig(env) {
  if (!env?.ADMIN_KV?.get) {
    return normalizeEmailIdentitiesConfig({});
  }
  try {
    const raw = await env.ADMIN_KV.get(CONFIG_KEY);
    if (!raw) return normalizeEmailIdentitiesConfig({});
    return normalizeEmailIdentitiesConfig(JSON.parse(raw));
  } catch {
    return normalizeEmailIdentitiesConfig({});
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {ReturnType<typeof normalizeEmailIdentitiesConfig>} config
 */
export async function writeEmailIdentitiesConfig(env, config) {
  if (!env?.ADMIN_KV?.put) throw new Error("ADMIN_KV binding not configured");
  await putKvJsonIfChanged(env.ADMIN_KV, CONFIG_KEY, normalizeEmailIdentitiesConfig(config));
}

/**
 * @param {ReturnType<typeof normalizeEmailIdentitiesConfig>} config
 */
export function sanitizeEmailIdentitiesForClient(config) {
  return {
    domain: config.domain,
    opsForwardTo: config.opsForwardTo,
    identities: config.identities.map((item) => ({
      ...item,
      email: identityEmail(item.localPart, config.domain),
    })),
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
}

/**
 * @param {ReturnType<typeof normalizeEmailIdentitiesConfig>} config
 * @param {string} localPart
 * @param {Partial<import("./email-identities-config.js").EmailIdentity>} patch
 */
export function upsertIdentity(config, localPart, patch) {
  const key = String(localPart).trim().toLowerCase();
  const identities = [...config.identities];
  const index = identities.findIndex((item) => item.localPart === key);
  const base =
    index >= 0
      ? identities[index]
      : {
          id: key,
          localPart: key,
          displayName: key,
          category: "custom",
          forwardTo: config.opsForwardTo,
          enabled: true,
          routingStatus: "pending",
          cloudflareRuleId: null,
          provisionedAt: null,
        };
  const next = normalizeIdentity({ ...base, ...patch, localPart: key });
  if (!next) throw new Error("Invalid identity");
  if (index >= 0) identities[index] = next;
  else identities.push(next);
  return {
    ...config,
    identities: identities.sort((a, b) => a.localPart.localeCompare(b.localPart)),
  };
}
