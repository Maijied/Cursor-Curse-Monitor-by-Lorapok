const fs = require("fs");
const path = require("path");
const assert = require("assert");

async function run() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    console.log("Skipping fallback test: node:sqlite is not available in this Node runtime");
    return;
  }

  const dbPath = path.join(__dirname, "mock.vscdb");
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore missing file
  }

  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE ItemTable (key TEXT, value TEXT);");

  const initialConfig = {
    aiSettings: {
      modelConfig: {
        composer: { modelName: "gpt-4", maxMode: true, selectedModels: [] },
      },
    },
  };

  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
    JSON.stringify(initialConfig)
  );
  db.close();

  process.env.CURSOR_DB_PATH = dbPath;
  process.env.CURSOR_EDITOR_RUNNING = "0";

  const Module = require("module");
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "vscode") {
      return require.resolve("./mock-vscode.js");
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  require("ts-node").register({ transpileOnly: true });
  const { applyComposerFallbackModel } = require("../src/cursorAuth.ts");

  const res = await applyComposerFallbackModel();
  assert.strictEqual(res.success, true);
  assert.notStrictEqual(res.alreadySet, true);

  const db2 = new DatabaseSync(dbPath, { readOnly: true });
  const row = db2
    .prepare("SELECT value FROM ItemTable WHERE key = ?")
    .get(
      "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser"
    );
  db2.close();

  const composer = JSON.parse(row.value).aiSettings.modelConfig.composer;
  assert.strictEqual(composer.modelName, "composer-2.5");
  assert.strictEqual(composer.maxMode, false);
  assert.strictEqual(composer.selectedModels[0].modelId, "composer-2.5");
  console.log("fallback test passed");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    const dbPath = path.join(__dirname, "mock.vscdb");
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // ignore
    }
  });
