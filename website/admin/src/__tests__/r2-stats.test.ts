import { describe, expect, it } from "vitest";
import {
  isStatsR2Available,
  probeStatsR2,
  writeStatsArtifactsR2,
  readStatsBadgesR2,
  STATS_R2_BADGES_KEY,
} from "../../functions/api/_shared/r2-stats.js";

function mockR2(store = new Map()) {
  return {
    put: async (key, body, opts) => {
      store.set(key, { body, opts });
    },
    get: async (key) => {
      const entry = store.get(key);
      if (!entry) return null;
      return { text: async () => entry.body };
    },
    head: async (key) => {
      if (!store.has(key)) {
        const err = new Error("not found");
        err.code = "10007";
        throw err;
      }
    },
    __store: store,
  };
}

describe("r2-stats", () => {
  it("detects missing binding", async () => {
    expect(isStatsR2Available({})).toBe(false);
    await expect(probeStatsR2({})).resolves.toEqual({
      configured: false,
      ok: false,
      error: "STATS_R2 binding missing",
    });
  });

  it("writes and reads badge bundle", async () => {
    const bucket = mockR2();
    const env = { STATS_R2: bucket };
    const bundle = { total: { label: "downloads", message: "1" } };
    const ok = await writeStatsArtifactsR2(env, { svg: "<svg></svg>", badgeBundle: bundle });
    expect(ok).toBe(true);
    expect(bucket.__store.has(STATS_R2_BADGES_KEY)).toBe(true);
    const loaded = await readStatsBadgesR2(env);
    expect(loaded?.total?.message).toBe("1");
  });

  it("probes empty bucket as ok", async () => {
    const env = { STATS_R2: mockR2() };
    const probe = await probeStatsR2(env);
    expect(probe).toEqual({ configured: true, ok: true });
  });
});
