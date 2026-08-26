/** @typedef {{ email?: string; address?: string; name?: unknown; replyTo?: string }} MailFromInput */

const DEFAULT_FROM_NAME = "Cursor Curse Monitor";

/**
 * Cloudflare EmailAddress.name must be a string when present — never null/number/object.
 * @param {unknown} value
 * @param {string} [fallback=""]
 */
export function coerceMailDisplayName(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

/**
 * @param {MailFromInput | string | null | undefined} from
 * @param {string} [defaultName=DEFAULT_FROM_NAME]
 */
export function normalizeMailFromInput(from, defaultName = DEFAULT_FROM_NAME) {
  if (typeof from === "string") {
    const email = from.trim();
    return { email, name: defaultName, replyTo: email };
  }

  const email = String(from?.email ?? from?.address ?? "")
    .trim()
    .toLowerCase();
  const name = coerceMailDisplayName(from?.name, defaultName);
  const replyTo = String(from?.replyTo ?? email).trim().toLowerCase() || email;
  return { email, name, replyTo };
}

/**
 * Workers EMAIL.send — prefer plain strings; named objects always use string name.
 * @param {MailFromInput | string} from
 */
export function toWorkerFrom(from) {
  const normalized = normalizeMailFromInput(from);
  return { email: normalized.email, name: normalized.name };
}

/**
 * REST /accounts/.../email/sending/send — uses address + optional name.
 * @param {MailFromInput | string} from
 */
export function toRestFrom(from) {
  const normalized = normalizeMailFromInput(from);
  if (!normalized.name) return normalized.email;
  return { address: normalized.email, name: normalized.name };
}

/**
 * @param {unknown} recipient
 */
export function toWorkerRecipient(recipient) {
  if (typeof recipient === "string") return recipient.trim().toLowerCase();
  if (!recipient || typeof recipient !== "object") return "";
  const email = String(recipient.email ?? recipient.address ?? "")
    .trim()
    .toLowerCase();
  const name = coerceMailDisplayName(recipient.name, "");
  if (!email) return "";
  return name ? { email, name } : email;
}

/**
 * @param {unknown} recipients
 */
export function toWorkerRecipients(recipients) {
  if (Array.isArray(recipients)) {
    return recipients.map(toWorkerRecipient).filter(Boolean);
  }
  const one = toWorkerRecipient(recipients);
  return one || undefined;
}

/**
 * @param {unknown} recipients
 */
export function toRestRecipients(recipients) {
  if (Array.isArray(recipients)) {
    return recipients.map(toWorkerRecipient).filter(Boolean);
  }
  return toWorkerRecipient(recipients) || undefined;
}

/**
 * @param {unknown} replyTo
 * @param {string} [fallback=""]
 */
export function toWorkerReplyTo(replyTo, fallback = "") {
  const value = String(replyTo ?? fallback).trim().toLowerCase();
  return value || undefined;
}

/**
 * @param {unknown} replyTo
 * @param {string} [fallback=""]
 */
export function toRestReplyTo(replyTo, fallback = "") {
  return toWorkerReplyTo(replyTo, fallback);
}
