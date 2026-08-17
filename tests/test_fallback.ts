import * as fs from "fs";
import * as path from "path";
import initSqlJs from "sql.js";

async function run() {
  console.log("Mocking database...");
  const dbPath = path.join(__dirname, "mock.vscdb");
  const wasmPath = path.join(__dirname, "..", "media", "sql-wasm.wasm");

  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const db = new SQL.Database();
  db.run("CREATE TABLE ItemTable (key TEXT, value TEXT);");

  const initialConfig = {
    aiSettings: {
      modelConfig: {
        composer: { modelName: "gpt-4", maxMode: true, selectedModels: [] }
      }
    }
  };

  db.run("INSERT INTO ItemTable VALUES (?, ?)", [
    "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
    JSON.stringify(initialConfig)
  ]);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();

  // Now try to run our logic
  const cursorAuth = require('../src/cursorAuth');
  process.env.CURSOR_DB_PATH = dbPath;

  const res = await cursorAuth.applyComposerFallbackModel(wasmPath);
  console.log("Result:", res);

  const db2 = new SQL.Database(fs.readFileSync(dbPath));
  const result = db2.exec("SELECT value FROM ItemTable WHERE key = ?", ["src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser"]);
  console.log("New config:", JSON.parse(result[0].values[0][0]));
}

run().catch(console.error);
