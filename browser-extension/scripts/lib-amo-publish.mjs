/**
 * Helpers for idempotent Firefox AMO publish flows.
 */
export function isAmoVersionAlreadyPublished(output) {
  const text = String(output ?? "");
  return /already exists/i.test(text) || (/Conflict/i.test(text) && /"version"/i.test(text));
}
