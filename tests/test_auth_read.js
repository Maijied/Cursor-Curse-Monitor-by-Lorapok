const fs = require("fs");
const path = require("path");
const assert = require("assert");

async function run() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    console.log("Skipping auth-read test: node:sqlite is not available in this Node runtime");
    return;
  }

  const dbPath = path.join(__dirname, "mock-auth.vscdb");
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore missing file
  }

  // Create a mock SQLite database with auth rows
  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE ItemTable (key TEXT, value TEXT);");
  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    "cursorAuth/accessToken",
    "test_access_token"
  );
  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    "cursorAuth/cachedEmail",
    "user@example.com"
  );
  db.close();

  // Point the env to the mock database
  process.env.CURSOR_DB_PATH = dbPath;

  // Mock the vscode module before requiring cursorAuth
  // (cursorAuth.ts imports vscode but doesn't use it in the read path)
  require.extensions[".ts"] = require.extensions[".ts"] || undefined;
  const Module = require("module");
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "vscode") {
      // Return a stub — the read functions don't use vscode
      return require.resolve("./mock-vscode.js");
    }
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  require("ts-node").register({ transpileOnly: true });
  const { readCursorAccessToken, readCachedAccountEmail } = require("../src/cursorAuth.ts");

  const token = await readCursorAccessToken("unused.wasm");
  const email = await readCachedAccountEmail("unused.wasm");

  assert.strictEqual(token, "test_access_token");
  assert.strictEqual(email, "user@example.com");
  console.log("auth-read test passed");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    const dbPath = path.join(__dirname, "mock-auth.vscdb");
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // ignore
    }
  });
