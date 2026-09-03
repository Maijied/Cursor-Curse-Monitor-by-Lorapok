import assert from "node:assert/strict";
import {
  backupPointKey,
  ensureKvBackupPoint,
  listKvBackupPoints,
  readKvBackupPoint,
} from "./kv-backup.js";

function mockKv(store = new Map()) {
  return {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
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

const kv = mockKv();
const payload = JSON.stringify([{ id: "legacy", ts: "2026-01-01T00:00:00.000Z" }]);
await kv.put("api:activity", payload);

const first = await ensureKvBackupPoint(kv, "api:activity", { reason: "test" });
assert.equal(first.backedUp, true);
assert.ok(first.backupKey?.startsWith("backup:point:"));
assert.equal(await kv.get("api:activity"), payload, "live key must remain");

const second = await ensureKvBackupPoint(kv, "api:activity", { reason: "test" });
assert.equal(second.backedUp, false);
assert.equal(second.reason, "unchanged");

const points = await listKvBackupPoints(kv, "api:activity");
assert.equal(points.length, 1);

const envelope = await readKvBackupPoint(kv, points[0].backupKey);
assert.equal(envelope.payload, payload);
assert.equal(backupPointKey("api:activity").includes("api-activity"), true);

console.log("kv-backup.test.mjs: OK");
