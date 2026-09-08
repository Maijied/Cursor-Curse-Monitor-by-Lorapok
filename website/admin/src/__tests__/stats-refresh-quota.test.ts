import { describe, expect, it, beforeEach } from "vitest";
import { clearKvWritePause, markKvWriteQuotaHit } from "../../functions/api/_shared/kv-put.js";
import { runStatsRefresh } from "../../functions/api/_shared/stats-refresh.js";
import { STATS_REFRESH_CONFIG_KEY } from "../../functions/api/_shared/stats-refresh-config.js";

function mockEnv(config: Record<string, unknown>) {
  const store = new Map<string, string>([
    [STATS_REFRESH_CONFIG_KEY, JSON.stringify(config)],
  ]);
  return {
    ADMIN_KV: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    },
    store,
  };
}

describe("stats-refresh KV quota guard", () => {
  beforeEach(() => {
    clearKvWritePause();
  });

  it("skips automatic refresh when writesPausedUntil is active", async () => {
    const pauseUntil = "2099-01-01T00:00:00.000Z";
    const env = mockEnv({
      enabled: true,
      intervalMinutes: 5,
      writesPausedUntil: pauseUntil,
      lastRunAt: null,
    });

    const result = await runStatsRefresh(env, { triggeredBy: "cron" });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("kv_writes_paused");
    expect(result.writesPausedUntil).toBe(pauseUntil);
    expect(result.notice).toMatch(/KV daily write limit/i);
  });

  it("skips when in-memory KV pause is active", async () => {
    markKvWriteQuotaHit();
    const env = mockEnv({
      enabled: true,
      intervalMinutes: 5,
      lastRunAt: null,
    });

    const result = await runStatsRefresh(env, { triggeredBy: "cron" });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("kv_writes_paused");
  });
});
