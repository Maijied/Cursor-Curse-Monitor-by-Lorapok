/** Shared KV retention limits — keep blobs small and scatter TTLs aligned. */

export const MAX_MAILBOX_MESSAGES = 200;
export const MAX_MAILBOX_TEXT_CHARS = 50_000;
export const MAX_MAILBOX_HTML_CHARS = 100_000;

export const MAX_SYSTEM_LOG_ENTRIES = 500;
export const MAX_API_ACTIVITY_ENTRIES = 500;

export const SYSTEM_LOG_TTL_SECONDS = 30 * 24 * 60 * 60;
export const API_ACTIVITY_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * @param {string | null | undefined} value
 * @param {number} max
 */
export function truncateStoredText(value, max) {
  if (max <= 0) return "";
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}
