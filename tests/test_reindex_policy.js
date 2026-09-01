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
        reindexEnabled: true,
        reindexWritePolicy: "live",
        requireEditorQuit: false,
      },
    }
  );
  assert.notStrictEqual(
    liveResult.error,
    "Editor is still running. Quit Cursor/VS Code completely before reindexing — live database writes are disabled to protect your data.",
    "live policy should not block on running editor"
  );

  const quitResult = await reindexMissingConversations(
    { fsPath: __dirname },
    {
      policy: {
        reindexEnabled: true,
        reindexWritePolicy: "quit-first",
        requireEditorQuit: true,
      },
    }
  );
  assert.strictEqual(quitResult.success, false);
  assert.match(quitResult.error || "", /Editor is still running/i);

  const disabledResult = await reindexMissingConversations(
    { fsPath: __dirname },
    {
      policy: {
        reindexEnabled: false,
        reindexWritePolicy: "live",
        requireEditorQuit: false,
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
