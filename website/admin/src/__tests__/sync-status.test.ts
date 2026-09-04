import { describe, expect, it } from "vitest";
import { isKvQuotaError, kvQuotaKind } from "../../functions/api/_shared/kv-quota.js";

/**
 * Mirrors sync/status KV quota classification used in production handlers.
 */
function classifySyncKvQuota(lastRunError: string | null) {
  const kvQuotaHit = Boolean(lastRunError && isKvQuotaError(lastRunError));
  const kvQuotaLimitKind = lastRunError ? kvQuotaKind(lastRunError) : null;
  return { kvQuotaHit, kvQuotaLimitKind };
}

describe("sync-status kv classification", () => {
  it("flags get-limit errors as read quota", () => {
    const result = classifySyncKvQuota("KV get() limit exceeded for the day.");
    expect(result.kvQuotaHit).toBe(true);
    expect(result.kvQuotaLimitKind).toBe("read");
  });

  it("ignores unrelated errors", () => {
    const result = classifySyncKvQuota("GitHub API rate limit");
    expect(result.kvQuotaHit).toBe(false);
    expect(result.kvQuotaLimitKind).toBe(null);
  });
});
