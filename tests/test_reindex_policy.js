const assert = require("assert");

async function run() {
  process.env.CURSOR_EDITOR_RUNNING = "1";

  const Module = require("module");
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "vscode") {
      return require.resolve("./mock-vscode.js");
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  require("ts-node").register({ transpileOnly: true });
  const { reindexMissingConversations } = require("../src/conversationReindex.ts");

  const liveResult = await reindexMissingConversations(
    { fsPath: __dirname },
    {
      policy: {
        indexEnabled: true,
        reindexEnabled: true,
        reindexWritePolicy: "live",
        indexWritePolicy: "live",
        requireEditorQuit: false,
        cipExportEnabled: true,
        cipImportEnabled: true,
        transcriptLookbackDays: 0,
        maxReindexRecords: 5000,
        maxExportRecords: 5000,
        maxImportRecords: 5000,
        cipRequireSanitization: true,
        cipDedupeAcrossUsers: false,
        cipAllowCrossUserLocalImport: false,
        cipEnabled: true,
      },
    }
  );
  assert.strictEqual(liveResult.success, false);
  assert.match(
    liveResult.error || "",
    /Composer template missing/i,
    "live policy should pass the editor-running gate and fail later"
  );

  const quitResult = await reindexMissingConversations(
    { fsPath: __dirname },
    {
      policy: {
        indexEnabled: true,
        reindexEnabled: true,
        reindexWritePolicy: "quit-first",
        indexWritePolicy: "quit-first",
        requireEditorQuit: true,
        cipExportEnabled: true,
        cipImportEnabled: true,
        transcriptLookbackDays: 0,
        maxReindexRecords: 5000,
        maxExportRecords: 5000,
        maxImportRecords: 5000,
        cipRequireSanitization: true,
        cipDedupeAcrossUsers: false,
        cipAllowCrossUserLocalImport: false,
        cipEnabled: true,
      },
    }
  );
  assert.strictEqual(quitResult.success, false);
  assert.match(quitResult.error || "", /Editor is still running/i);

  const disabledResult = await reindexMissingConversations(
    { fsPath: __dirname },
    {
      policy: {
        indexEnabled: false,
        reindexEnabled: false,
        reindexWritePolicy: "live",
        indexWritePolicy: "live",
        requireEditorQuit: false,
        cipExportEnabled: false,
        cipImportEnabled: false,
        transcriptLookbackDays: 0,
        maxReindexRecords: 5000,
        maxExportRecords: 5000,
        maxImportRecords: 5000,
        cipRequireSanitization: true,
        cipDedupeAcrossUsers: false,
        cipAllowCrossUserLocalImport: false,
        cipEnabled: false,
      },
    }
  );
  assert.strictEqual(disabledResult.success, false);
  assert.match(disabledResult.error || "", /disabled by Mission Control/i);

  Module._resolveFilename = originalResolveFilename;
  delete process.env.CURSOR_EDITOR_RUNNING;
  console.log("reindex-policy test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
