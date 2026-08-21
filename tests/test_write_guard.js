const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");

async function run() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    console.log("Skipping write-guard test: node:sqlite unavailable");
    return;
  }

  const dbPath = path.join(__dirname, "mock-guard.vscdb");
  try {
    fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }

  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE ItemTable (key TEXT, value TEXT);");
  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
    JSON.stringify({ aiSettings: { modelConfig: { composer: { modelName: "gpt-4" } } } })
  );
  db.close();

  process.env.CURSOR_DB_PATH = dbPath;
  process.env.CURSOR_EDITOR_RUNNING = "1";

  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "vscode") {
      return require.resolve("./mock-vscode.js");
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  require("ts-node").register({ transpileOnly: true });
  const { applyComposerFallbackModel, createFullBackup } = require("../src/cursorAuth.ts");

  const refused = await applyComposerFallbackModel();
  assert.strictEqual(refused.success, false);
  assert.match(String(refused.error), /still running|Quit/i);

  process.env.CURSOR_EDITOR_RUNNING = "0";
  const bundle = createFullBackup(dbPath);
  assert.ok(bundle);
  assert.ok(bundle.files.some((f) => f.original === dbPath));

  const ok = await applyComposerFallbackModel();
  assert.strictEqual(ok.success, true);

  console.log("write-guard / backup test passed");
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    const dbPath = path.join(__dirname, "mock-guard.vscdb");
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
    for (const f of fs.readdirSync(__dirname)) {
      if (f.startsWith("mock-guard.vscdb.backup-")) {
        try {
          fs.unlinkSync(path.join(__dirname, f));
        } catch {
          /* ignore */
        }
      }
    }
  });
