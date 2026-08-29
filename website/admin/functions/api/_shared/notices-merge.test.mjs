#!/usr/bin/env node
import assert from "node:assert/strict";
import { mergeBuiltinNotices, CONVERSATION_RECOVERY_NOTICE, GENERATED_DEV_NOTICE } from "./notices.js";

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

console.log("notices-merge.test.mjs: OK");
