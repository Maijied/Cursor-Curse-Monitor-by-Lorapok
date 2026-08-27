/**
 * Cloudflare deploy retry helpers.
 * Global Client API limit: 1200 requests / 5 minutes per token (429 + Retry-After).
 * @see https://developers.cloudflare.com/fundamentals/api/reference/limits/
 */

/** @param {string} output */
export function classifyWranglerFailure(output) {
  if (/10429|Rate limited/i.test(output)) return "rate-limit";
  if (/9109|Max auth failures|Invalid access token/i.test(output)) return "auth-lockout";
  if (/10000|Authentication error/i.test(output)) return "auth";
  return "other";
}

/** @param {string | null | undefined} output */
export function parseRetryAfterSec(output) {
  if (!output) return null;
  const headerMatch = output.match(/Retry-After:\s*(\d+)/i);
  if (headerMatch) return Number(headerMatch[1]);
  const secMatch = output.match(/retry(?:\s+after|\s+in)\s+(\d+)\s*(?:s|sec|seconds?)/i);
  if (secMatch) return Number(secMatch[1]);
  const minMatch = output.match(/retry(?:\s+after|\s+in)\s+(\d+)\s*(?:m|min|minutes?)/i);
  if (minMatch) return Number(minMatch[1]) * 60;
  return null;
}

/** @param {ReturnType<typeof classifyWranglerFailure>} kind @param {number} attempt */
export function wranglerRetryWaitSec(kind, attempt) {
  if (kind === "rate-limit") return 25 + attempt * 15;
  if (kind === "auth-lockout") return 40 + attempt * 20;
  if (kind === "auth") return 20 + attempt * 15;
  return 15 + attempt * 10;
}

/**
 * Prefer Cloudflare Retry-After when present; cap at 300s (global 5-minute window).
 * @param {ReturnType<typeof classifyWranglerFailure>} kind
 * @param {number} attempt
 * @param {string | null | undefined} output
 */
export function resolveRetryWaitSec(kind, attempt, output) {
  const base = wranglerRetryWaitSec(kind, attempt);
  const retryAfter = parseRetryAfterSec(output);
  if (retryAfter == null || Number.isNaN(retryAfter)) return base;
  return Math.min(Math.max(base, retryAfter), 300);
}
