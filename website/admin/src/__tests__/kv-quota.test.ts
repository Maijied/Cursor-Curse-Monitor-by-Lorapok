import { describe, expect, it } from "vitest";
import {
  formatKvQuotaError,
  isKvQuotaError,
  kvQuotaKind,
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
});
