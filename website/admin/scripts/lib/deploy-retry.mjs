/** @param {string} output */
export function classifyWranglerFailure(output) {
  if (/10429|Rate limited/i.test(output)) return "rate-limit";
  if (/9109|Max auth failures|Invalid access token/i.test(output)) return "auth-lockout";
  if (/10000|Authentication error/i.test(output)) return "auth";
  return "other";
}

/** @param {ReturnType<typeof classifyWranglerFailure>} kind @param {number} attempt */
export function wranglerRetryWaitSec(kind, attempt) {
  if (kind === "rate-limit") return 60 + attempt * 30;
  if (kind === "auth-lockout") return 90 + attempt * 45;
  if (kind === "auth") return 45 + attempt * 30;
  return 30 + attempt * 20;
}
