import { describe, expect, it, vi } from "vitest";
import { logApiActivity, readApiActivity } from "../../functions/api/_shared/activity-log.js";
import { recordMailboxMessage, listMailboxMessages } from "../../functions/api/_shared/mailbox.js";
import { logSystemEvent, readSystemLogs } from "../../functions/api/_shared/system-log.js";
import {
  readSubscribers,
  upsertSubscriber,
  SUBSCRIBER_EMAIL_PREFIX,
} from "../../functions/api/_shared/subscribers.js";
import { submitProductFeedback } from "../../functions/api/_shared/feedback-submit.js";
import {
  listScatterRecords,
  putScatterEntity,
  reverseSortToken,
} from "../../functions/api/_shared/kv-scatter.js";

function mockKv(store = new Map()) {
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
    list: async ({ prefix = "", limit = 1000 } = {}) => ({
      keys: [...store.keys()]
        .filter((name) => name.startsWith(prefix))
        .slice(0, limit)
        .map((name) => ({ name })),
      list_complete: true,
    }),
  };
}

describe("kv scatter-gather", () => {
  it("orders reverse sort tokens newest-first", () => {
    const older = reverseSortToken(1_000);
    const newer = reverseSortToken(2_000);
    expect(newer.localeCompare(older)).toBeLessThan(0);
  });

  it("appends API activity with scatter keys and drops legacy aggregate on read", async () => {
    const store = new Map();
    store.set(
      "api:activity",
      JSON.stringify([{ id: "legacy", ts: "2026-01-01T00:00:00.000Z", method: "GET", path: "/old", status: 200, latencyMs: 1 }])
    );
    const env = { ADMIN_KV: mockKv(store) };
    await logApiActivity(env, { method: "POST", path: "/api/deploy", status: 202, latencyMs: 12, email: "admin@test" });
    expect([...store.keys()].filter((k) => k.startsWith("api:activity:"))).toHaveLength(1);
    const rows = await readApiActivity(env);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(store.has("api:activity")).toBe(false);
  });

  it("trims mailbox blob payload size", async () => {
    const store = new Map();
    const env = { ADMIN_KV: mockKv(store) };
    const entry = await recordMailboxMessage(env, {
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "user@example.com",
      subject: "Welcome",
      text: "hello",
      html: "<p>".repeat(10_000),
      status: "sent",
      category: "subscribe",
    });
    expect(entry.html).toBe("");
    await recordMailboxMessage(env, {
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "another@example.com",
      subject: "Second",
      text: "world",
      html: "<p>".repeat(10_000),
      status: "sent",
      category: "subscribe",
    });
    const items = await listMailboxMessages(env, {});
    expect(items).toHaveLength(2);
    const parsed = JSON.parse(store.get("mailbox:messages") ?? "[]");
    expect(JSON.stringify(parsed).length).toBeLessThan(20_000);
  });

  it("appends system logs with one put per event", async () => {
    const store = new Map();
    const env = { ADMIN_KV: mockKv(store) };
    await logSystemEvent(env, { source: "test", message: "first" });
    await logSystemEvent(env, { source: "test", message: "second" });
    expect([...store.keys()].filter((k) => k.startsWith("system:log:"))).toHaveLength(2);
    const logs = await readSystemLogs(env);
    expect(logs).toHaveLength(2);
    expect(logs.map((row) => row.message).sort()).toEqual(["first", "second"]);
  });

  it("stores subscribers per email without rewriting a blob", async () => {
    const store = new Map();
    const kv = mockKv(store);
    const first = await upsertSubscriber(kv, { email: "user@example.com", source: "website" });
    expect(first.ok).toBe(true);
    expect(first.alreadySubscribed).toBe(false);

    const repeat = await upsertSubscriber(kv, { email: "user@example.com", source: "website" });
    expect(repeat.ok).toBe(true);
    expect(repeat.alreadySubscribed).toBe(true);
    expect(repeat.kvWriteSkipped).toBe(true);

    const blobWrites = [...store.keys()].filter((k) => k === "subscribers");
    expect(blobWrites).toHaveLength(0);
    expect([...store.keys()].filter((k) => k.startsWith(`${SUBSCRIBER_EMAIL_PREFIX}:`))).toHaveLength(1);

    const items = await readSubscribers(kv);
    expect(items.some((row) => row.email === "user@example.com")).toBe(true);
  });

  it("stores feedback as scatter records", async () => {
    const store = new Map();
    const env = { ADMIN_KV: mockKv(store) };
    const result = await submitProductFeedback(env, {
      kind: "bug",
      message: "Scatter-gather feedback storage regression check.",
      source: "vitest",
    });
    expect(result.ok).toBe(true);
    expect(result.stored).toBe(true);
    const feedbackKeys = [...store.keys()].filter((k) => k.startsWith("feedback:item:"));
    expect(feedbackKeys).toHaveLength(1);
    const logs = await listScatterRecords(env.ADMIN_KV, "system:log", { limit: 10 });
    expect(logs).toHaveLength(1);
  });

  it("merges legacy blob logs with scatter records during migration", async () => {
    const store = new Map();
    const legacy = [
      { id: "legacy-1", ts: "2026-01-01T00:00:00.000Z", source: "legacy", message: "old" },
    ];
    store.set("system:logs", JSON.stringify(legacy));
    const env = { ADMIN_KV: mockKv(store) };
    await logSystemEvent(env, { source: "test", message: "new" });
    const logs = await readSystemLogs(env);
    expect(logs).toHaveLength(2);
    expect(logs.map((row) => row.message).sort()).toEqual(["new", "old"]);
  });

  it("falls back to legacy logs when scatter list fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const legacy = [
      { id: "legacy-1", ts: "2026-01-01T00:00:00.000Z", source: "legacy", message: "fallback" },
    ];
    const env = {
      ADMIN_KV: {
        get: async (key) => (key === "system:logs" ? JSON.stringify(legacy) : null),
        put: async () => {},
        list: async () => {
          throw new Error("KV list unavailable");
        },
      },
    };
    try {
      const logs = await readSystemLogs(env);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe("fallback");
      expect(errorSpy).toHaveBeenCalledWith("readSystemLogs scatter list failed", expect.any(Error));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("skips entity put when unchanged", async () => {
    const store = new Map();
    const kv = mockKv(store);
    await putScatterEntity(kv, "subscriber:email", "a@b.com", { email: "a@b.com", source: "x" });
    const writesBefore = store.size;
    const skipped = await putScatterEntity(kv, "subscriber:email", "a@b.com", { email: "a@b.com", source: "x" });
    expect(skipped).toBe(false);
    expect(store.size).toBe(writesBefore);
  });
});
