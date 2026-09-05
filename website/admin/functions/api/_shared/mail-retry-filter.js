/**
 * Classify failed-mail log recipients for local retry scripts.
 * Test/probe inboxes are skipped — they should not be resent via Resend.
 * @param {string} email
 * @returns {{ kind: "production" | "test" | "invalid"; reason?: string }}
 */
export function classifyMailRetryRecipient(email) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return { kind: "invalid", reason: "invalid email" };
  }
  if (e.endsWith("@example.com")) {
    return { kind: "test", reason: "example.com probe address" };
  }
  if (e.endsWith("@inbox.testmail.app")) {
    return { kind: "test", reason: "testmail inbox" };
  }
  const local = e.split("@")[0] ?? "";
  if (/^(probe|test|mail-test|mail-verify|check-|post-push|stable-|prod-mail-check)/i.test(local)) {
    return { kind: "test", reason: "probe or test local-part" };
  }
  return { kind: "production" };
}

/** @param {string} email */
export function isProductionMailRetryRecipient(email) {
  return classifyMailRetryRecipient(email).kind === "production";
}
