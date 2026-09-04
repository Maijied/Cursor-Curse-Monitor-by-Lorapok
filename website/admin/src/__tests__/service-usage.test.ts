import { describe, expect, it } from "vitest";
import {
  estimateBroadcastResendCapacity,
  getServiceCounts,
  isServiceQuotaAvailable,
  normalizeServiceUsageRecord,
  utcDayKey,
  utcMonthKey,
} from "../../functions/api/_shared/service-usage.js";

describe("service-usage", () => {
  it("tracks monthly and daily counts", () => {
    const day = utcDayKey();
    const record = normalizeServiceUsageRecord({
      services: {
        resend: { monthly: 42, daily: { [day]: 7 } },
      },
    });
    const counts = getServiceCounts(record, "resend");
    expect(counts.monthly).toBe(42);
    expect(counts.daily).toBe(7);
  });

  it("blocks resend when monthly quota exceeded", () => {
    const limits = { resend: { monthlyLimit: 3000, dailyLimit: 100 } };
    expect(isServiceQuotaAvailable("resend", limits, { monthly: 2999, daily: 1 })).toBe(true);
    expect(isServiceQuotaAvailable("resend", limits, { monthly: 3000, daily: 1 })).toBe(false);
    expect(isServiceQuotaAvailable("resend", limits, { monthly: 1, daily: 100 })).toBe(false);
  });

  it("estimates broadcast fallback when over resend slots", async () => {
    const env = {
      ADMIN_KV: {
        get: async () =>
          JSON.stringify({
            services: { resend: { monthly: 2998, daily: { [utcDayKey()]: 98 } } },
          }),
      },
    };
    const capacity = await estimateBroadcastResendCapacity(env, 5);
    expect(capacity.resendSlots).toBe(2);
    expect(capacity.willUseFallback).toBe(true);
    expect(capacity.fallbackCount).toBe(3);
  });

  it("uses UTC month key", () => {
    expect(utcMonthKey(new Date("2026-09-05T00:00:00.000Z"))).toBe("2026-09");
  });
});
