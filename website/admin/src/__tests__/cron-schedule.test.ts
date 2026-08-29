import { describe, expect, it } from "vitest";
import {
  clampIntervalMinutes,
  isCronJobDue,
  mergeCronJobConfig,
} from "../../functions/api/_shared/cron-schedule.js";

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
});
