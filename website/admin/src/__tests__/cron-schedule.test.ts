import { describe, expect, it } from "vitest";
import {
  clampIntervalMinutes,
  isCronJobDue,
  mergeCronJobConfig,
  recordCronJobRun,
} from "../../functions/api/_shared/cron-schedule.js";
import { isStatsLiveCacheFresh } from "../../functions/api/_shared/stats-refresh-config.js";

describe("cron-schedule", () => {
  it("clamps interval minutes within bounds", () => {
    expect(clampIntervalMinutes(0, 5, { min: 1, max: 60 })).toBe(1);
    expect(clampIntervalMinutes(999, 5, { min: 1, max: 60 })).toBe(60);
    expect(clampIntervalMinutes(12.7, 5, { min: 1, max: 60 })).toBe(13);
  });

  it("treats disabled jobs as never due", () => {
    expect(isCronJobDue({ enabled: false, intervalMinutes: 5, lastRunAt: null })).toBe(false);
  });

  it("runs when enabled and never run before", () => {
    expect(isCronJobDue({ enabled: true, intervalMinutes: 5, lastRunAt: null })).toBe(true);
  });

  it("respects interval since last run", () => {
    const now = Date.parse("2026-08-30T12:00:00.000Z");
    const config = {
      enabled: true,
      intervalMinutes: 60,
      lastRunAt: "2026-08-30T11:30:00.000Z",
    };
    expect(isCronJobDue(config, now)).toBe(false);
    expect(isCronJobDue(config, now + 31 * 60 * 1000)).toBe(true);
  });

  it("merges patch fields and clamps interval", () => {
    const merged = mergeCronJobConfig(
      { enabled: false, intervalMinutes: 5, updatedBy: null },
      { enabled: true, intervalMinutes: 120, updatedBy: "admin@test" },
      { min: 1, max: 60, defaultInterval: 5 }
    );
    expect(merged.enabled).toBe(true);
    expect(merged.intervalMinutes).toBe(60);
    expect(merged.updatedBy).toBe("admin@test");
  });

  it("recordCronJobRun preserves newer editable settings from KV", async () => {
    const store = new Map([
      [
        "integrations:discord-digest",
        JSON.stringify({
          enabled: false,
          intervalMinutes: 120,
          updatedBy: "admin@test",
        }),
      ],
    ]);
    const env = {
      ADMIN_KV: {
        get: async (key: string) => store.get(key) ?? null,
        put: async (key: string, value: string) => {
          store.set(key, value);
        },
      },
    };

    await recordCronJobRun(
      env,
      "integrations:discord-digest",
      { enabled: true, intervalMinutes: 1440 },
      { ok: true, durationMs: 42, triggeredBy: "cron" }
    );

    const saved = JSON.parse(store.get("integrations:discord-digest") ?? "{}");
    expect(saved.enabled).toBe(false);
    expect(saved.intervalMinutes).toBe(120);
    expect(saved.updatedBy).toBe("admin@test");
    expect(saved.lastRunOk).toBe(true);
    expect(saved.lastDurationMs).toBe(42);
  });
});

describe("isStatsLiveCacheFresh", () => {
  const now = Date.parse("2026-08-30T12:00:00.000Z");

  it("returns false when cache is missing or stale", () => {
    expect(isStatsLiveCacheFresh(null, 5 * 60 * 1000, now)).toBe(false);
    expect(
      isStatsLiveCacheFresh({ refreshedAt: "2026-08-30T11:50:00.000Z" }, 5 * 60 * 1000, now)
    ).toBe(false);
  });

  it("returns true when cache is within max age", () => {
    expect(
      isStatsLiveCacheFresh({ refreshedAt: "2026-08-30T11:56:00.000Z" }, 5 * 60 * 1000, now)
    ).toBe(true);
  });
});
