import { describe, expect, it } from "vitest";
import {
  formatKvQuotaError,
  isKvQuotaError,
  isKvWritesPaused,
  kvQuotaKind,
  nextUtcQuotaResetIso,
} from "../../functions/api/_shared/kv-quota.js";
import { formatKvPutError } from "../../functions/api/_shared/kv-put.js";

describe("kv-quota", () => {
  it("detects KV put limit errors", () => {
    expect(isKvQuotaError("KV put() limit exceeded for the day")).toBe(true);
    expect(kvQuotaKind("KV put() limit exceeded for the day")).toBe("write");
  });

  it("detects KV get limit errors", () => {
    expect(isKvQuotaError("KV get() limit exceeded for the day.")).toBe(true);
    expect(kvQuotaKind("KV get() limit exceeded for the day.")).toBe("read");
  });

  it("formats read vs write quota messages", () => {
    expect(formatKvQuotaError(new Error("KV get() limit exceeded for the day."))).toMatch(/read limit/i);
    expect(formatKvPutError(new Error("KV put() limit exceeded for the day"))).toMatch(/write limit/i);
  });

  it("computes next UTC quota reset and pause window", () => {
    const reset = nextUtcQuotaResetIso(Date.parse("2026-09-04T12:00:00.000Z"));
    expect(reset).toBe("2026-09-05T00:00:00.000Z");
    expect(isKvWritesPaused(reset, Date.parse("2026-09-04T23:00:00.000Z"))).toBe(true);
    expect(isKvWritesPaused(reset, Date.parse("2026-09-05T00:00:01.000Z"))).toBe(false);
  });
});
