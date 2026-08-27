/** @param {string} output */
export function classifyWranglerFailure(output) {
  if (/10429|Rate limited/i.test(output)) return "rate-limit";
  if (/9109|Max auth failures|Invalid access token/i.test(output)) return "auth-lockout";
  if (/10000|Authentication error/i.test(output)) return "auth";
  return "other";
}

/** @param {ReturnType<typeof classifyWranglerFailure>} kind @param {number} attempt */
export function wranglerRetryWaitSec(kind, attempt) {
  if (kind === "rate-limit") return 25 + attempt * 15;
  if (kind === "auth-lockout") return 40 + attempt * 20;
  if (kind === "auth") return 20 + attempt * 15;
  return 15 + attempt * 10;
}
