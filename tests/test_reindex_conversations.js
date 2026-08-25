const fs = require("fs");
const path = require("path");
const assert = require("assert");

async function run() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    console.log("Skipping reindex test: node:sqlite is not available in this Node runtime");
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(__dirname, "reindex-"));
  const workspacePath = path.join(tempDir, "demo-workspace");
  const stateDbPath = path.join(tempDir, "state.vscdb");
  const searchDbPath = path.join(tempDir, "conversation-search.db");
  const projectsRoot = path.join(tempDir, "projects", "demo-project", "agent-transcripts");
  const convId = "11111111-1111-1111-1111-111111111111";
  const jsonlPath = path.join(projectsRoot, convId, `${convId}.jsonl`);

  fs.mkdirSync(workspacePath, { recursive: true });
  fs.mkdirSync(path.dirname(jsonlPath), { recursive: true });
  fs.writeFileSync(
    jsonlPath,
    JSON.stringify({
      role: "user",
      message: {
        content: [
          {
            type: "text",
            text: "<timestamp>Thursday, Aug 13, 2026, 1:21 PM (UTC+6)</timestamp>\n<user_query>\nhello reindex test\n</user_query>",
          },
        ],
      },
    }) + "\n"
  );

  const stateDb = new DatabaseSync(stateDbPath);
  stateDb.exec(
    "CREATE TABLE composerHeaders (composerId TEXT PRIMARY KEY, workspaceId TEXT, createdAt INTEGER, lastUpdatedAt INTEGER, isArchived INTEGER, isSubagent INTEGER, recency INTEGER, checkpointAt INTEGER, value TEXT);"
  );
  stateDb.exec("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT);");
  stateDb.close();

  const searchDb = new DatabaseSync(searchDbPath);
  searchDb.exec(`CREATE TABLE conversations (
    fts_rowid INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    scope TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    branches TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    is_archived INTEGER NOT NULL,
    root_fingerprint TEXT,
    cache_fingerprint TEXT
  );`);
  searchDb.exec("CREATE VIRTUAL TABLE conversation_fts USING fts5(title, body, branches);");
  searchDb.exec("CREATE TABLE conversation_search_candidates (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL);");
  searchDb.close();

  process.env.CURSOR_DB_PATH = stateDbPath;
  process.env.CCM_REINDEX_PROJECTS_ROOT = path.join(tempDir, "projects");
  process.env.CCM_REINDEX_SEARCH_DB = searchDbPath;
  process.env.TEST_WORKSPACE_PATH = workspacePath;
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
  const { reindexMissingConversations } = require("../src/conversationReindex.ts");

  const extensionUri = { fsPath: path.join(__dirname, "..") };
  const result = await reindexMissingConversations(extensionUri);

  assert.strictEqual(result.success, true);
  assert.ok(result.searchIndexed.includes(convId), "expected conversation indexed for search");

  const verifySearch = new DatabaseSync(searchDbPath, { readOnly: true });
  const row = verifySearch.prepare("SELECT title FROM conversations WHERE id = ?").get(convId);
  verifySearch.close();

  assert.ok(row, "expected conversation in search db");
  console.log("reindex-conversations test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
