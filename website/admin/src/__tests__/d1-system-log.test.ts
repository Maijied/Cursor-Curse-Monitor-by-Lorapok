import { describe, expect, it } from "vitest";
import {
  insertSystemLogD1,
  mergeSystemLogEntries,
  normalizeSystemLogEntry,
  readSystemLogsD1,
  systemLogInsertSql,
} from "../../functions/api/_shared/d1-system-log.js";

function mockD1(initial = []) {
  const rows = [...initial];
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          if (sql.includes("INSERT")) {
            rows.push({
              id: args[0],
              ts: args[1],
              level: args[2],
              source: args[3],
              message: args[4],
              meta_json: args[5],
              email: args[6],
            });
          }
        },
        all: async () => ({
          results: [...rows]
            .sort((a, b) => Date.parse(String(b.ts)) - Date.parse(String(a.ts)))
            .slice(0, args[0]),
        }),
      }),
    }),
    __rows: rows,
  };
}

describe("d1-system-log", () => {
  it("builds insert SQL with escaping", () => {
    const sql = systemLogInsertSql(
      normalizeSystemLogEntry({
        id: "a",
        ts: "2026-01-01T00:00:00.000Z",
        source: "test",
        message: "it's fine",
      })
    );
    expect(sql).toContain("INSERT OR IGNORE");
    expect(sql).toContain("it''s fine");
  });

  it("merges batches by id and sorts newest first", () => {
    const merged = mergeSystemLogEntries(
      [{ id: "1", ts: "2026-01-02T00:00:00.000Z", level: "info", source: "a", message: "b", meta: {}, email: null }],
      [{ id: "1", ts: "2026-01-02T00:00:00.000Z", level: "info", source: "a", message: "dup", meta: {}, email: null }],
      [{ id: "2", ts: "2026-01-03T00:00:00.000Z", level: "info", source: "a", message: "newer", meta: {}, email: null }]
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("2");
  });

  it("inserts and reads from ADMIN_D1", async () => {
    const db = mockD1();
    const env = { ADMIN_D1: db };
    const ok = await insertSystemLogD1(env, { source: "vitest", message: "hello" });
    expect(ok).toBe(true);
    const logs = await readSystemLogsD1(env);
    expect(logs).toHaveLength(1);
    expect(logs?.[0].message).toBe("hello");
  });
});
