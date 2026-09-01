import assert from "node:assert/strict";
import {
  DEFAULT_CURSOR_INDEX_CONFIG,
  buildPublicCursorIndexPolicy,
  normalizeCursorIndexConfig,
  validateCursorIndexPatch,
} from "../functions/api/_shared/cursor-index-config.js";

assert.deepEqual(normalizeCursorIndexConfig({}), {
  ...DEFAULT_CURSOR_INDEX_CONFIG,
  updatedAt: null,
  updatedBy: null,
});

assert.strictEqual(
  normalizeCursorIndexConfig({ transcriptLookbackDays: 5000 }).transcriptLookbackDays,
  3650
);
assert.strictEqual(normalizeCursorIndexConfig({ maxReindexRecords: -10 }).maxReindexRecords, 0);

assert.deepEqual(validateCursorIndexPatch({ indexWritePolicy: "unsafe" }), [
  "indexWritePolicy must be live or quit-first",
]);
assert.deepEqual(validateCursorIndexPatch({ transcriptLookbackDays: 12.5 }), [
  "transcriptLookbackDays must be a non-negative integer",
]);
assert.deepEqual(validateCursorIndexPatch({ transcriptLookbackDays: 4000 }), [
  "transcriptLookbackDays must be at most 3650",
]);
assert.deepEqual(validateCursorIndexPatch({ indexEnabled: "yes" }), ["indexEnabled must be a boolean"]);
assert.deepEqual(validateCursorIndexPatch({ maxImportRecords: 100001 }), [
  "maxImportRecords must be at most 100000",
]);

const publicPolicy = buildPublicCursorIndexPolicy(
  normalizeCursorIndexConfig({ indexWritePolicy: "quit-first", cipExportEnabled: false })
);
assert.strictEqual(publicPolicy.requireEditorQuit, true);
assert.strictEqual(publicPolicy.cipEnabled, true);

console.log("cursor-index-config admin test passed");
