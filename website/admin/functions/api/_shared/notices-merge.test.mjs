#!/usr/bin/env node
import assert from "node:assert/strict";
import { mergeBuiltinNotices, CONVERSATION_RECOVERY_NOTICE, GENERATED_DEV_NOTICE, ensureCatalogSeeded } from "./notices.js";

const seeded = {
  seeded: true,
  items: [{ ...GENERATED_DEV_NOTICE }],
};
const { items, changed } = await mergeBuiltinNotices(seeded.items);
assert.equal(changed, true);
assert.equal(items.some((n) => n.id === CONVERSATION_RECOVERY_NOTICE.id), true);
assert.equal(items.some((n) => n.id === GENERATED_DEV_NOTICE.id), true);

const again = await mergeBuiltinNotices(items);
assert.equal(again.changed, false);

const corrupt = await mergeBuiltinNotices([null, { ...GENERATED_DEV_NOTICE }]);
assert.equal(corrupt.changed, true);
assert.equal(corrupt.items.some((n) => n.id === GENERATED_DEV_NOTICE.id), true);

const corruptEnv = {
  ADMIN_KV: {
    get: async (k) =>
      k === "notice:catalog"
        ? JSON.stringify({ seeded: true, items: [null, { id: "stale", enabled: false, source: "admin" }] })
        : null,
    put: async () => {},
  },
};
const recovered = await ensureCatalogSeeded(corruptEnv);
assert.ok(recovered.items.length >= 3);
assert.equal(recovered.items.some((n) => n == null), false);

console.log("notices-merge.test.mjs: OK");
