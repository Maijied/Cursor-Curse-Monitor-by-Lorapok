const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Extract bare email from "Name <user@domain.com>" or plain address.
 * @param {string} value
 */
export function extractEmailAddress(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const bracket = raw.match(/<([^<>]+)>/);
  if (bracket?.[1]) return bracket[1].trim().toLowerCase();
  const bare = raw.split(/\s+/).find((part) => part.includes("@"));
  return (bare ?? raw).trim().toLowerCase();
}

/**
 * Mask an email for audit logs and UI display.
 * - *@lorapok.tech → xxx@lorapok.tech
 * - external → first char + ***@domain (e.g. j***@gmail.com)
 * @param {string} value
 */
export function maskEmail(value) {
  const email = extractEmailAddress(value);
  if (!email || !EMAIL_RE.test(email)) return "***";

  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";

  if (domain === "lorapok.tech") {
    return `xxx@${domain}`;
  }

  const visible = `${local[0] || "x"}***`;
  return `${visible}@${domain}`;
}

/**
 * Preserve display name while masking the address part.
 * @param {string} value
 */
export function maskEmailDisplay(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const bracket = raw.match(/^(.+?)\s*<([^<>]+)>$/);
  if (bracket) {
    const masked = maskEmail(bracket[2]);
    const name = bracket[1].trim();
    return name ? `${name} <${masked}>` : masked;
  }

  return maskEmail(raw);
}
