import { describe, expect, it, beforeEach, vi } from "vitest";
import { clearKvWritePause, markKvWriteQuotaHit } from "../../functions/api/_shared/kv-put.js";
import { setFirestoreAccessTokenForTests } from "../../functions/api/_shared/firebase-store.js";
import * as firebaseStore from "../../functions/api/_shared/firebase-store.js";
import { runStatsRefresh } from "../../functions/api/_shared/stats-refresh.js";
import { STATS_REFRESH_CONFIG_KEY } from "../../functions/api/_shared/stats-refresh-config.js";

function mockEnv(config: Record<string, unknown>, withFirestore = false) {
  const store = new Map<string, string>([
    [STATS_REFRESH_CONFIG_KEY, JSON.stringify(config)],
  ]);
  const env: Record<string, unknown> = {
    ADMIN_KV: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    },
    SITE_DATA_URL: "https://example.com/site-data.json",
    store,
  };
  if (withFirestore) {
    env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: "cursor-curse-by-lorapok",
      client_email: "test@example.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    });
    env.FIREBASE_PROJECT_ID = "cursor-curse-by-lorapok";
  }
  return env;
}

describe("stats-refresh KV quota guard", () => {
  beforeEach(() => {
    clearKvWritePause();
    vi.restoreAllMocks();
    setFirestoreAccessTokenForTests("tok");
  });

  it("skips automatic refresh when writesPausedUntil is active and Firestore unavailable", async () => {
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

  it("skips when in-memory KV pause is active without Firestore credentials", async () => {
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

  it("continues refresh when KV paused but Firestore fallback is configured", async () => {
    markKvWriteQuotaHit();
    vi.spyOn(firebaseStore, "putFirestoreJsonSafe").mockResolvedValue({ ok: true, wrote: true });
    const env = mockEnv(
      {
        enabled: true,
        intervalMinutes: 5,
        lastRunAt: null,
      },
      true
    );

    global.fetch = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.includes("site-data.json")) {
        return new Response(
          JSON.stringify({
            generatedAt: "2026-01-01T00:00:00.000Z",
            packageVersion: "1.0.0",
            downloads: { displayTotal: 10, verified: true },
          }),
          { status: 200 }
        );
      }
      return new Response("[]", { status: 200 });
    }) as typeof fetch;

    const result = await runStatsRefresh(env, { triggeredBy: "cron", force: true });
    expect(result.skipped).not.toBe(true);
    expect(result.ok).toBe(true);
  });
});
