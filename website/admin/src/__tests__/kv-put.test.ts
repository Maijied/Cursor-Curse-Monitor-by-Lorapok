import { describe, expect, it } from "vitest";
import {
  formatKvPutError,
  putKvJsonIfChanged,
  putKvStringIfChanged,
} from "../../functions/api/_shared/kv-put.js";

function mockKv(store = new Map()) {
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
  };
}

describe("kv-put", () => {
  it("formats Cloudflare KV quota errors", () => {
    expect(formatKvPutError(new Error("KV put() limit exceeded for the day"))).toMatch(
      /daily write limit/i
    );
  });

  it("skips put when JSON value is unchanged", async () => {
    const store = new Map([["k", JSON.stringify({ a: 1 })]]);
    const env = { ADMIN_KV: mockKv(store) };
    const wrote = await putKvJsonIfChanged(env, "k", { a: 1 });
    expect(wrote).toBe(false);
    expect(store.size).toBe(1);
  });

  it("writes when JSON value changes", async () => {
    const store = new Map([["k", JSON.stringify({ a: 1 })]]);
    const env = { ADMIN_KV: mockKv(store) };
    const wrote = await putKvJsonIfChanged(env, "k", { a: 2 });
    expect(wrote).toBe(true);
    expect(JSON.parse(store.get("k"))).toEqual({ a: 2 });
  });

  it("skips string put when unchanged", async () => {
    const store = new Map([["svg", "<svg/>"]]);
    const env = { ADMIN_KV: mockKv(store) };
    const wrote = await putKvStringIfChanged(env, "svg", "<svg/>");
    expect(wrote).toBe(false);
  });
});
