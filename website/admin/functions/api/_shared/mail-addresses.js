import { tryGetMasterEmail } from "./admins.js";

/** Lorapok CCM outbound identities (domain must be onboarded in Cloudflare Email Sending). */
export const MAIL_MONITOR = "cursor.monitor@lorapok.tech";
export const MAIL_HELP = "cursor.curse.help@lorapok.tech";
export const MAIL_LEGACY = "cursor-contact@lorapok.tech";

export const FROM_NAME_MONITOR = "Cursor Curse Monitor";
export const FROM_NAME_HELP = "CCM Help";

/**
 * Default inbound forward / outbound BCC target from env (never hardcode a personal inbox).
 * Priority: MAIL_REDIRECT_TO → ADMIN_MASTER_EMAIL / VITE_ADMIN_MASTER_EMAIL.
 * @param {Record<string, unknown>} [env]
 * @returns {string}
 */
export function resolveDefaultOpsForwardTo(env = {}) {
  const redirect = String(env.MAIL_REDIRECT_TO ?? "").trim().toLowerCase();
  if (redirect.includes("@")) return redirect;
  const master = tryGetMasterEmail(env);
  return master ?? "";
}

/**
 * Pick the From address for a mail category.
 * @param {string} [category]
 */
export function resolveMailFrom(category = "system") {
  const key = String(category).toLowerCase();
  if (key === "help" || key === "support") {
    return { email: MAIL_HELP, name: FROM_NAME_HELP, replyTo: MAIL_HELP };
  }
  return { email: MAIL_MONITOR, name: FROM_NAME_MONITOR, replyTo: MAIL_MONITOR };
}

/** BCC ops inbox on every outbound message when configured. */
export function defaultMailBcc(env = {}) {
  const ops = resolveDefaultOpsForwardTo(env);
  return ops ? [ops] : [];
}
