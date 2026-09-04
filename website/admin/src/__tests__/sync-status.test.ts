import { describe, expect, it } from "vitest";
import { isKvQuotaError, isKvWritesPaused, kvQuotaKind } from "../../functions/api/_shared/kv-quota.js";

/**
 * Mirrors sync/status KV quota classification used in production handlers.
 */
function classifySyncKvQuota(
  lastRunError: string | null,
  writesPausedUntil: string | null,
  now = Date.now()
) {
  const kvWritesPaused = isKvWritesPaused(writesPausedUntil, now);
  const kvQuotaHit = Boolean((lastRunError && isKvQuotaError(lastRunError)) || kvWritesPaused);
  const kvQuotaLimitKind = lastRunError ? kvQuotaKind(lastRunError) : kvWritesPaused ? "write" : null;
  return { kvQuotaHit, kvQuotaLimitKind, kvWritesPaused };
}

describe("sync-status kv classification", () => {
  it("flags get-limit errors as read quota", () => {
    const result = classifySyncKvQuota("KV get() limit exceeded for the day.", null);
    expect(result.kvQuotaHit).toBe(true);
    expect(result.kvQuotaLimitKind).toBe("read");
  });

  it("ignores unrelated errors", () => {
    const result = classifySyncKvQuota("GitHub API rate limit", null);
    expect(result.kvQuotaHit).toBe(false);
    expect(result.kvQuotaLimitKind).toBe(null);
  });

  it("flags active writesPausedUntil as quota pressure", () => {
    const result = classifySyncKvQuota(null, "2099-01-01T00:00:00.000Z");
    expect(result.kvQuotaHit).toBe(true);
    expect(result.kvWritesPaused).toBe(true);
    expect(result.kvQuotaLimitKind).toBe("write");
  });
});
