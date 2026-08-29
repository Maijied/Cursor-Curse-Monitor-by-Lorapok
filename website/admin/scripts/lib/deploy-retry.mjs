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
  if (kind === "rate-limit") return 60 + attempt * 30;
  if (kind === "auth-lockout") return 120 + attempt * 60;
  if (kind === "auth") return 90 + attempt * 30;
  return 30 + attempt * 15;
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

/** @param {boolean | "rate-limited"} probeResult */
export function relayWorkerProbeExists(probeResult) {
  return probeResult === true || probeResult === "rate-limited";
}

/**
 * Pre-deploy cooldown before wrangler pages deploy (seconds).
 * @param {{ inCi?: boolean; skipMailSetup?: boolean; mailLightweight?: boolean; env?: Record<string, string|undefined> }} options
 */
export function resolvePagesPreDeployCooldownSec(options = {}) {
  const { inCi = false, skipMailSetup = false, mailLightweight = false, env = {} } = options;
  if (!inCi) return 0;
  const lightweight = mailLightweight || skipMailSetup;
  if (lightweight) return Number(env.CF_DEPLOY_PRE_COOLDOWN_SEC_LIGHT ?? 0);
  return Number(env.CF_DEPLOY_PRE_COOLDOWN_SEC ?? 90);
}

/**
 * Stop retry loop when further wrangler calls would worsen Cloudflare auth lockouts.
 * @param {{ sawRateLimit: boolean; failureKind: ReturnType<typeof classifyWranglerFailure>; attempt: number; maxAttempts: number }} state
 */
export function shouldStopPagesDeployRetries(state) {
  const { sawRateLimit, failureKind, attempt, maxAttempts } = state;
  if (attempt >= maxAttempts) {
    return { stop: true, reason: "max-attempts" };
  }
  if (
    sawRateLimit &&
    (failureKind === "auth-lockout" || failureKind === "auth") &&
    attempt >= 2
  ) {
    return { stop: true, reason: "auth-lockout-after-rate-limit" };
  }
  return { stop: false, reason: null };
}
