const fs = require("fs");
const path = require("path");
const assert = require("assert");

async function run() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    console.log("Skipping local-store test: node:sqlite is not available in this Node runtime");
    return;
  }

  const dbPath = path.join(__dirname, "mock-local.vscdb");
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore
  }

  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE ItemTable (key TEXT, value TEXT);");
  db.exec(`CREATE TABLE composerHeaders (
    composerId TEXT,
    workspaceId TEXT,
    recency INTEGER,
    isArchived INTEGER,
    isSubagent INTEGER,
    value TEXT
  );`);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    `aiCodeTracking.dailyStats.v1.5.${todayKey}`,
    JSON.stringify({
      date: todayKey,
      tabSuggestedLines: 10,
      tabAcceptedLines: 4,
      composerSuggestedLines: 20,
      composerAcceptedLines: 18,
    })
  );
  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
    JSON.stringify({
      aiSettings: {
        teamId: 42,
        modelConfig: {
          composer: { modelName: "grok-4.6" },
          "cmd-k": { modelName: "default" },
        },
        modelLastUsedAt: { "grok-4.6": "2026-08-17T13:00:00.000Z" },
      },
    })
  );
  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    "cursorAuth/cachedTeam",
    JSON.stringify({ teamId: 42, name: "Lorapok Team" })
  );
  db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
    "cursorAuth/stripeMembershipType",
    "enterprise"
  );
  db.prepare(
    "INSERT INTO composerHeaders (composerId, workspaceId, recency, isArchived, isSubagent, value) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    "sess-1",
    "ws-1",
    Date.now(),
    0,
    0,
    JSON.stringify({
      name: "Dashboard redesign",
      unifiedMode: "agent",
      totalLinesAdded: 12,
      totalLinesRemoved: 3,
    })
  );
  db.prepare(
    "INSERT INTO composerHeaders (composerId, workspaceId, recency, isArchived, isSubagent, value) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    "sess-sub",
    "ws-1",
    Date.now(),
    0,
    1,
    JSON.stringify({ name: "Hidden subagent", unifiedMode: "agent" })
  );
  db.close();

  process.env.CURSOR_DB_PATH = dbPath;

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
    parseDailyStats,
    parseModelConfig,
    parseComposerHeader,
    readLocalInsights,
  } = require("../src/cursorLocalStore.ts");

  const stats = parseDailyStats(
    JSON.stringify({
      date: "2026-08-17",
      tabSuggestedLines: 1,
      tabAcceptedLines: 2,
      composerSuggestedLines: 3,
      composerAcceptedLines: 4,
    })
  );
  assert.strictEqual(stats.composerAcceptedLines, 4);

  const models = parseModelConfig(
    JSON.stringify({
      aiSettings: {
        modelConfig: { composer: { modelName: "composer-2.5" } },
        modelLastUsedAt: { "composer-2.5": "2026-08-17T00:00:00.000Z" },
      },
    })
  );
  assert.strictEqual(models.models[0].modelName, "composer-2.5");
  assert.strictEqual(models.lastUsedModel, "composer-2.5");

  const session = parseComposerHeader(
    JSON.stringify({ name: "Hello", unifiedMode: "plan", totalLinesAdded: 1, totalLinesRemoved: 0 }),
    { composerId: "abc", recency: Date.now() }
  );
  assert.strictEqual(session.name, "Hello");
  assert.strictEqual(session.mode, "plan");

  const insights = readLocalInsights();
  assert.ok(insights.today, "today stats should load");
  assert.strictEqual(insights.today.tabAcceptedLines, 4);
  assert.strictEqual(insights.cycleAccepted, 22);
  assert.strictEqual(insights.models[0].modelName, "grok-4.6");
  assert.strictEqual(insights.teamName, "Lorapok Team");
  assert.strictEqual(insights.membershipType, "enterprise");
  assert.strictEqual(insights.sessions.length, 1);
  assert.strictEqual(insights.sessions[0].name, "Dashboard redesign");

  console.log("local-store test passed");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    const dbPath = path.join(__dirname, "mock-local.vscdb");
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // ignore
    }
  });
