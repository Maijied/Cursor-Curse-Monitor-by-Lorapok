import { describe, expect, it } from "vitest";
import { hashSubscriberEmail, upsertSubscriberD1, readSubscriberD1 } from "../../functions/api/_shared/d1-subscribers.js";

function mockD1() {
  const store = new Map();
  return {
    store,
    db: {
      prepare: (sql) => ({
        bind: (...args) => ({
          run: async () => {
            if (sql.includes("INSERT INTO subscriber_index")) {
              store.set(args[0], {
                email_hash: args[0],
                subscribed_at: args[1],
                source: args[2],
                meta_json: args[3],
              });
            }
          },
          first: async () => store.get(args[0]) ?? null,
          all: async () => ({ results: [...store.values()] }),
        }),
      }),
    },
  };
}

describe("d1 subscribers", () => {
  it("hashes emails deterministically", async () => {
    const a = await hashSubscriberEmail("user@example.com");
    const b = await hashSubscriberEmail("USER@example.com");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("upserts and reads subscriber records", async () => {
    const { db, store } = mockD1();
    const env = { ADMIN_D1: db };
    const record = {
      email: "user@example.com",
      subscribedAt: "2026-09-05T00:00:00.000Z",
      source: "website",
      installId: null,
      consentVersion: "2026-08-25",
    };
    const saved = await upsertSubscriberD1(env, record);
    expect(saved.ok).toBe(true);
    expect(store.size).toBe(1);

    const row = await readSubscriberD1(env, "user@example.com");
    expect(row?.email).toBe("user@example.com");
    expect(row?.source).toBe("website");
  });
});
