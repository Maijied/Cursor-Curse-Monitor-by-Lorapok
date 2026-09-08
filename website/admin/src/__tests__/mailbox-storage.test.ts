import { describe, expect, it, beforeEach } from "vitest";
import { clearKvWritePause, markKvWriteQuotaHit } from "../../functions/api/_shared/kv-put.js";
import { recordMailboxMessage, listMailboxMessages, patchMailboxMessage } from "../../functions/api/_shared/mailbox.js";

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

function mockD1Mail() {
  const rows = new Map();
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          if (sql.includes("INSERT")) {
            rows.set(args[0], {
              id: args[0],
              ts: args[1],
              direction: args[2],
              from_addr: args[3],
              to_addr: args[4],
              subject: args[5],
              text_body: args[6],
              html_body: args[7],
              status: args[8],
              category: args[9],
              sent_by: args[10],
              error: args[11],
              read_flag: args[12],
            });
          }
          if (sql.includes("UPDATE")) {
            const row = rows.get(args[1]);
            if (row) row.read_flag = args[0];
          }
        },
        first: async () => rows.get(args[0]) ?? null,
        all: async () => ({
          results: [...rows.values()].sort((a, b) => String(b.ts).localeCompare(String(a.ts))),
        }),
      }),
    }),
    __rows: rows,
  };
}

function mockR2(store = new Map()) {
  return {
    put: async (key, value) => {
      store.set(key, value);
    },
    get: async (key) => {
      const value = store.get(key);
      if (!value) return null;
      return { text: async () => value };
    },
  };
}

describe("mailbox D1/R2 storage", () => {
  beforeEach(() => {
    clearKvWritePause();
  });

  it("writes mailbox messages to D1 without KV blob or backup keys", async () => {
    const kvStore = new Map();
    const r2Store = new Map();
    const env = {
      ADMIN_KV: mockKv(kvStore),
      ADMIN_D1: mockD1Mail(),
      STATS_R2: mockR2(r2Store),
    };

    const entry = await recordMailboxMessage(env, {
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "user@example.com",
      subject: "Welcome",
      text: "hello",
      html: "<p>hello</p>",
      status: "sent",
      category: "subscribe",
    });

    expect(entry.id).toBeTruthy();
    expect(kvStore.has("mailbox:messages")).toBe(false);
    expect([...kvStore.keys()].filter((k) => k.startsWith("backup:point:"))).toHaveLength(0);
    expect([...r2Store.keys()].some((k) => k.startsWith("mail/outbox/"))).toBe(true);

    const items = await listMailboxMessages(env, {});
    expect(items).toHaveLength(1);
    expect(items[0].to).toBe("user@example.com");
  });

  it("patches read state in D1 without KV writes", async () => {
    const kvStore = new Map();
    const env = {
      ADMIN_KV: mockKv(kvStore),
      ADMIN_D1: mockD1Mail(),
    };

    const entry = await recordMailboxMessage(env, {
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "user@example.com",
      subject: "Read test",
      text: "body",
      status: "sent",
      category: "test",
      read: false,
    });

    const patched = await patchMailboxMessage(env, entry.id, { read: true });
    expect(patched?.read).toBe(true);
    expect(kvStore.size).toBe(0);
  });

  it("skips KV when quota is hit and D1 is primary", async () => {
    const kvStore = new Map();
    let kvPutCalls = 0;
    const env = {
      ADMIN_KV: {
        get: async (key) => kvStore.get(key) ?? null,
        put: async (key, value) => {
          kvPutCalls += 1;
          kvStore.set(key, value);
        },
      },
      ADMIN_D1: mockD1Mail(),
      STATS_R2: mockR2(new Map()),
    };

    markKvWriteQuotaHit();

    const entry = await recordMailboxMessage(env, {
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "user@example.com",
      subject: "Quota test",
      text: "body",
      status: "sent",
      category: "test",
    });

    expect(entry.id).toBeTruthy();
    expect(kvPutCalls).toBe(0);
    expect(kvStore.has("mailbox:messages")).toBe(false);

    const items = await listMailboxMessages(env, {});
    expect(items).toHaveLength(1);
  });

  it("falls back to R2 archive only when KV mode and quota blocked", async () => {
    const kvStore = new Map();
    let kvPutCalls = 0;
    const r2Store = new Map();
    const env = {
      CCM_MAIL_STORAGE: "kv",
      ADMIN_KV: {
        get: async (key) => kvStore.get(key) ?? null,
        put: async (key, value) => {
          kvPutCalls += 1;
          kvStore.set(key, value);
        },
      },
      STATS_R2: mockR2(r2Store),
    };

    markKvWriteQuotaHit();

    const entry = await recordMailboxMessage(env, {
      direction: "outbound",
      from: "cursor.monitor@lorapok.tech",
      to: "user@example.com",
      subject: "KV blocked",
      text: "body",
      status: "sent",
      category: "test",
    });

    expect(entry.id).toBeTruthy();
    expect(kvPutCalls).toBe(0);
    expect([...r2Store.keys()].some((k) => k.startsWith("mail/outbox/"))).toBe(true);
  });
});
