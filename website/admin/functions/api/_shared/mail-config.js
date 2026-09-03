import { putKvJsonIfChanged } from "./kv-put.js";
import {
  MAIL_HELP,
  MAIL_MONITOR,
  MAIL_OPS_COPY,
  FROM_NAME_HELP,
  FROM_NAME_MONITOR,
} from "./mail-addresses.js";

const CONFIG_KEY = "integrations:mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_MAIL_CONFIG = {
  productEmail: MAIL_MONITOR,
  supportEmail: MAIL_HELP,
  opsBccEmail: MAIL_OPS_COPY,
  productFromName: FROM_NAME_MONITOR,
  supportFromName: FROM_NAME_HELP,
  resendFirstExternal: true,
  workersFreeMode: true,
  sendingDomain: "lorapok.tech",
  resendFromOverride: "",
  resendDomainVerified: false,
};

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * @param {string} domain
 */
export function isValidSendingDomain(domain) {
  const value = String(domain ?? "").trim().toLowerCase();
  if (!value || value.length > 253) return false;
  return DOMAIN_RE.test(value);
}

/**
 * @param {string} email
 */
export function isValidMailAddress(email) {
  if (!email || typeof email !== "string") return false;
  return EMAIL_RE.test(email.trim());
}

/**
 * @param {Record<string, unknown>} parsed
 */
export function normalizeMailConfig(parsed) {
  const productEmail = String(parsed.productEmail ?? DEFAULT_MAIL_CONFIG.productEmail).trim();
  const supportEmail = String(parsed.supportEmail ?? DEFAULT_MAIL_CONFIG.supportEmail).trim();
  const opsBccEmail = String(parsed.opsBccEmail ?? DEFAULT_MAIL_CONFIG.opsBccEmail).trim();

  return {
    productEmail: isValidMailAddress(productEmail) ? productEmail : DEFAULT_MAIL_CONFIG.productEmail,
    supportEmail: isValidMailAddress(supportEmail) ? supportEmail : DEFAULT_MAIL_CONFIG.supportEmail,
    opsBccEmail: isValidMailAddress(opsBccEmail) ? opsBccEmail : DEFAULT_MAIL_CONFIG.opsBccEmail,
    productFromName: String(parsed.productFromName ?? DEFAULT_MAIL_CONFIG.productFromName).trim() ||
      DEFAULT_MAIL_CONFIG.productFromName,
    supportFromName: String(parsed.supportFromName ?? DEFAULT_MAIL_CONFIG.supportFromName).trim() ||
      DEFAULT_MAIL_CONFIG.supportFromName,
    resendFirstExternal: parsed.resendFirstExternal !== false,
    workersFreeMode: parsed.workersFreeMode !== false,
    sendingDomain: isValidSendingDomain(parsed.sendingDomain)
      ? String(parsed.sendingDomain).trim().toLowerCase()
      : DEFAULT_MAIL_CONFIG.sendingDomain,
    resendFromOverride: String(parsed.resendFromOverride ?? "").trim(),
    resendDomainVerified: parsed.resendDomainVerified === true,
    updatedAt: parsed.updatedAt ?? null,
    updatedBy: parsed.updatedBy ?? null,
  };
}

/**
 * Strict KV read for writes — propagates storage and parse failures.
 * @param {Record<string, unknown>} env
 */
async function readMailConfigFromKv(env) {
  if (!env?.ADMIN_KV?.get) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const raw = await env.ADMIN_KV.get(CONFIG_KEY);
  if (!raw) return { ...DEFAULT_MAIL_CONFIG, updatedAt: null, updatedBy: null };
  return normalizeMailConfig(JSON.parse(raw));
}

/**
 * @param {Record<string, unknown>} env
 */
export async function readMailConfig(env) {
  if (!env?.ADMIN_KV?.get) return { ...DEFAULT_MAIL_CONFIG, updatedAt: null, updatedBy: null };
  try {
    return await readMailConfigFromKv(env);
  } catch {
    return { ...DEFAULT_MAIL_CONFIG, updatedAt: null, updatedBy: null };
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {Record<string, unknown>} patch
 */
export async function writeMailConfig(env, patch) {
  if (!env?.ADMIN_KV?.put) {
    throw new Error("ADMIN_KV binding not configured");
  }
  const current = await readMailConfigFromKv(env);
  const next = normalizeMailConfig({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy ?? current.updatedBy ?? null,
  });
  await putKvJsonIfChanged(env, CONFIG_KEY, next);
  return next;
}

/**
 * @param {ReturnType<typeof normalizeMailConfig>} config
 * @param {string} [category]
 */
export function resolveMailFromConfig(config, category = "system") {
  const key = String(category).toLowerCase();
  if (key === "help" || key === "support") {
    return {
      email: config.supportEmail,
      name: config.supportFromName,
      replyTo: config.supportEmail,
    };
  }
  return {
    email: config.productEmail,
    name: config.productFromName,
    replyTo: config.productEmail,
  };
}

/**
 * @param {ReturnType<typeof normalizeMailConfig>} config
 */
export function defaultBccFromConfig(config) {
  return [config.opsBccEmail];
}

/**
 * @param {ReturnType<typeof normalizeMailConfig>} config
 * @param {ReturnType<import("./mail.js").getMailTransportStatus>} transport
 * @param {Record<string, unknown>} env
 */
export function sanitizeMailConfigForClient(config, transport, env) {
  const testmailConfigured = Boolean(
    String(env?.TESTMAIL_API_KEY ?? "").trim() && String(env?.TESTMAIL_NAMESPACE ?? "").trim()
  );

  return {
    productEmail: config.productEmail,
    supportEmail: config.supportEmail,
    opsBccEmail: config.opsBccEmail,
    productFromName: config.productFromName,
    supportFromName: config.supportFromName,
    resendFirstExternal: config.resendFirstExternal,
    workersFreeMode: config.workersFreeMode,
    sendingDomain: config.sendingDomain,
    resendFromOverride: config.resendFromOverride,
    resendDomainVerified: config.resendDomainVerified,
    resendFromEnvConfigured: Boolean(String(env?.RESEND_FROM ?? "").trim()),
    transport: transport.transport ?? "none",
    transportConfigured: transport.configured,
    relayBound: transport.relayBound ?? false,
    restConfigured: transport.restConfigured ?? false,
    resendConfigured: transport.resendConfigured ?? false,
    testmailConfigured,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}
