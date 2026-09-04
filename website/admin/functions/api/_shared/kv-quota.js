/**
 * Cloudflare KV daily quota error detection (read and write limits).
 */

const KV_QUOTA_RE =
  /put\(\) limit exceeded|get\(\) limit exceeded|10027|kv put limit|kv get limit|daily.*limit/i;

/**
 * @param {unknown} messageOrError
 */
export function isKvQuotaError(messageOrError) {
  const message =
    messageOrError instanceof Error ? messageOrError.message : String(messageOrError ?? "");
  return KV_QUOTA_RE.test(message);
}

/**
 * @param {unknown} messageOrError
 * @returns {"read" | "write" | "unknown" | null}
 */
export function kvQuotaKind(messageOrError) {
  const message =
    messageOrError instanceof Error ? messageOrError.message : String(messageOrError ?? "");
  if (!KV_QUOTA_RE.test(message)) return null;
  if (/get\(\) limit/i.test(message)) return "read";
  if (/put\(\) limit/i.test(message)) return "write";
  return "unknown";
}

/**
 * @param {unknown} err
 */
export function formatKvQuotaError(err) {
  const message = err instanceof Error ? err.message : String(err ?? "Save failed");
  if (!isKvQuotaError(message)) return message || "Save failed";

  const kind = kvQuotaKind(message);
  if (kind === "read") {
    return (
      "Cloudflare KV daily read limit reached. Stats refresh and health checks may fail until the " +
      "quota resets (UTC). Pause automatic stats refresh in Settings → Automation or wait for reset."
    );
  }
  return (
    "Cloudflare KV daily write limit reached. Pause automatic stats refresh in Settings → Automation " +
    "(it writes several KV keys per run) or try again after the limit resets (UTC)."
  );
}

/**
 * ISO timestamp for the next UTC midnight (when Cloudflare KV daily limits reset).
 * @param {number} [now]
 */
export function nextUtcQuotaResetIso(now = Date.now()) {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}

/**
 * @param {string | null | undefined} writesPausedUntil
 * @param {number} [now]
 */
export function isKvWritesPaused(writesPausedUntil, now = Date.now()) {
  if (!writesPausedUntil) return false;
  const until = Date.parse(String(writesPausedUntil));
  return !Number.isNaN(until) && until > now;
}
