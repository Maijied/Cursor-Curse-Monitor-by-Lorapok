import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearKvWritePause,
  formatKvPutError,
  getInMemoryKvWritePause,
  isKvWriteBlockedEarly,
  markKvWriteQuotaHit,
  putKvJsonIfChanged,
  putKvJsonSafe,
  putKvStringIfChanged,
  putKvStringSafe,
} from "../../functions/api/_shared/kv-put.js";
import * as firebaseStore from "../../functions/api/_shared/firebase-store.js";

function mockKv(store = new Map()) {
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function mockEnv(store = new Map()) {
  return {
    ADMIN_KV: mockKv(store),
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
      project_id: "cursor-curse-by-lorapok",
      client_email: "test@example.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    }),
    FIREBASE_PROJECT_ID: "cursor-curse-by-lorapok",
  };
}

describe("kv-put", () => {
  beforeEach(() => {
    clearKvWritePause();
    vi.restoreAllMocks();
  });

  it("formats Cloudflare KV quota errors", () => {
    expect(formatKvPutError(new Error("KV put() limit exceeded for the day"))).toMatch(
      /daily write limit/i
    );
  });

  it("skips put when JSON value is unchanged", async () => {
    const store = new Map([["k", JSON.stringify({ a: 1 })]]);
    const env = { ADMIN_KV: mockKv(store) };
    const result = await putKvJsonIfChanged(env, "k", { a: 1 });
    expect(result.changed).toBe(false);
    expect(store.size).toBe(1);
  });

  it("writes when JSON value changes", async () => {
    const store = new Map([["k", JSON.stringify({ a: 1 })]]);
    const env = { ADMIN_KV: mockKv(store) };
    const result = await putKvJsonIfChanged(env, "k", { a: 2 });
    expect(result.changed).toBe(true);
    expect(JSON.parse(store.get("k")!)).toEqual({ a: 2 });
  });

  it("accepts a KV namespace passed directly (legacy callers)", async () => {
    const store = new Map();
    const kv = mockKv(store);
    const result = await putKvJsonIfChanged(kv, "legacy", { ok: true });
    expect(result.changed).toBe(true);
    expect(JSON.parse(store.get("legacy")!)).toEqual({ ok: true });
  });

  it("skips string put when unchanged", async () => {
    const store = new Map([["svg", "<svg/>"]]);
    const env = { ADMIN_KV: mockKv(store) };
    const result = await putKvStringIfChanged(env, "svg", "<svg/>");
    expect(result.changed).toBe(false);
  });

  it("putKvStringSafe returns gracefully on quota errors without throwing", async () => {
    const kv = {
      get: async () => null,
      put: async () => {
        throw new Error("KV put() limit exceeded for the day");
      },
    };
    const result = await putKvStringSafe({ ADMIN_KV: kv }, "hot:key", "value");
    expect(result.quotaExceeded).toBe(true);
    expect(result.wrote).toBe(false);
    expect(result.skipped).toBe(true);
    expect(getInMemoryKvWritePause()).toBeTruthy();
  });

  it("falls back to Firestore when KV quota is hit", async () => {
    const putSpy = vi.spyOn(firebaseStore, "putFirestoreSafe").mockResolvedValue({
      ok: true,
      wrote: true,
    });
    const kv = {
      get: async () => null,
      put: async () => {
        throw new Error("KV put() limit exceeded for the day");
      },
    };
    const env = mockEnv();
    env.ADMIN_KV = kv;

    const result = await putKvStringSafe(env, "integrations:stats-refresh", '{"enabled":true}');
    expect(result.quotaExceeded).toBe(true);
    expect(result.firestoreFallback).toBe(true);
    expect(result.wrote).toBe(true);
    expect(putSpy).toHaveBeenCalledWith(
      env,
      "integrations:stats-refresh",
      '{"enabled":true}',
      { skipIfUnchanged: false }
    );
  });

  it("blocks subsequent safe puts after quota hit until pause cleared", async () => {
    markKvWriteQuotaHit();
    const store = new Map();
    const env = { ADMIN_KV: mockKv(store) };
    const result = await putKvJsonSafe(env, "later:key", { a: 1 });
    expect(result.skipped).toBe(true);
    expect(result.quotaExceeded).toBe(true);
    expect(store.size).toBe(0);
    expect(isKvWriteBlockedEarly()).toBe(true);
  });

  it("putKvStringIfChanged returns gracefully on quota without throwing", async () => {
    const kv = {
      get: async () => null,
      put: async () => {
        throw new Error("KV put() limit exceeded for the day");
      },
    };
    const result = await putKvStringIfChanged({ ADMIN_KV: kv }, "config:key", "v");
    expect(result.quotaExceeded).toBe(true);
    expect(result.changed).toBe(false);
    expect(getInMemoryKvWritePause()).toBeTruthy();
  });
});
