const assert = require("assert");

async function run() {
  const Module = require("module");
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "vscode") {
      return require.resolve("./mock-vscode.js");
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  require("ts-node").register({ transpileOnly: true });
  const {
    normalizePolicy,
    transcriptCutoffMs,
    lookbackLabel,
    clearCursorIndexPolicyCache,
  } = require("../src/cursorIndexConfig.ts");

  const defaults = normalizePolicy({});
  assert.strictEqual(defaults.indexEnabled, true);
  assert.strictEqual(defaults.indexWritePolicy, "live");
  assert.strictEqual(defaults.transcriptLookbackDays, 0);
  assert.strictEqual(defaults.maxReindexRecords, 5000);

  const quitFirst = normalizePolicy({ indexWritePolicy: "quit-first" });
  assert.strictEqual(quitFirst.requireEditorQuit, true);

  const legacy = normalizePolicy({ reindexWritePolicy: "quit-first", reindexEnabled: false });
  assert.strictEqual(legacy.indexEnabled, false);
  assert.strictEqual(legacy.reindexEnabled, false);

  const disabledCip = normalizePolicy({
    indexEnabled: false,
    cipExportEnabled: true,
    cipImportEnabled: true,
  });
  assert.strictEqual(disabledCip.cipExportEnabled, false);
  assert.strictEqual(disabledCip.cipImportEnabled, false);
  assert.strictEqual(disabledCip.cipEnabled, false);

  const clamped = normalizePolicy({
    transcriptLookbackDays: 99999,
    maxReindexRecords: -5,
    maxExportRecords: 1.9,
  });
  assert.strictEqual(clamped.transcriptLookbackDays, 3650);
  assert.strictEqual(clamped.maxReindexRecords, 0);
  assert.strictEqual(clamped.maxExportRecords, 1);

  const now = Date.UTC(2026, 8, 1, 12, 0, 0);
  assert.strictEqual(transcriptCutoffMs(normalizePolicy({ transcriptLookbackDays: 0 }), now), null);
  const sevenDayCutoff = transcriptCutoffMs(normalizePolicy({ transcriptLookbackDays: 7 }), now);
  assert.strictEqual(sevenDayCutoff, now - 7 * 24 * 60 * 60 * 1000);

  assert.match(lookbackLabel(normalizePolicy({ transcriptLookbackDays: 0 })), /all available transcripts/i);
  assert.match(lookbackLabel(normalizePolicy({ transcriptLookbackDays: 1 })), /last 1 day/i);
  assert.match(lookbackLabel(normalizePolicy({ transcriptLookbackDays: 14 })), /last 14 days/i);

  delete process.env.CCM_INDEX_ENABLED;
  delete process.env.CCM_REINDEX_ENABLED;
  delete process.env.CCM_TRANSCRIPT_LOOKBACK_DAYS;
  clearCursorIndexPolicyCache();

  process.env.CCM_INDEX_ENABLED = "0";
  const { resolveCursorIndexPolicy } = require("../src/cursorIndexConfig.ts");
  const disabled = await resolveCursorIndexPolicy(true);
  assert.strictEqual(disabled.indexEnabled, false);

  process.env.CCM_TRANSCRIPT_LOOKBACK_DAYS = "21";
  const lookbackOverride = await resolveCursorIndexPolicy(true);
  assert.strictEqual(lookbackOverride.transcriptLookbackDays, 21);

  delete process.env.CCM_INDEX_ENABLED;
  delete process.env.CCM_TRANSCRIPT_LOOKBACK_DAYS;
  clearCursorIndexPolicyCache();

  Module._resolveFilename = originalResolveFilename;
  console.log("cursor-index-config test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
