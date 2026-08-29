const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "vscode") {
    return require.resolve("./mock-vscode.js");
  }
  if (request === "@lorapok/cursor-monitor-shared") {
    return require.resolve("../packages/shared/dist/index.js");
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require("ts-node").register({ transpileOnly: true });

const {
  emptyLocalInsights,
  parseDailyStats,
  parseModelConfig,
  formatRelativeTime,
  parseComposerHeader,
  readLocalInsights,
  normalizeDailyStatsDate,
  dailyStatsRowIsToday,
  todayKey,
} = require("../src/cursorLocalStore.ts");

test("local store: emptyLocalInsights returns a clean default structure", () => {
  const empty = emptyLocalInsights();
  assert.deepStrictEqual(empty, {
    today: null,
    cycleSuggested: 0,
    cycleAccepted: 0,
    tabAccepted: 0,
    composerAccepted: 0,
    models: [],
    lastUsedModel: null,
    sessions: [],
    teamName: null,
    teamId: null,
    membershipType: null,
  });
});

test("local store: parseDailyStats handles valid, partial, string-coerced, and corrupted inputs", () => {
  // Valid full data
  const valid = parseDailyStats(
    JSON.stringify({
      date: "2026-08-21",
      tabSuggestedLines: 50,
      tabAcceptedLines: 25,
      composerSuggestedLines: 100,
      composerAcceptedLines: 80,
    })
  );
  assert.strictEqual(valid.date, "2026-08-21");
  assert.strictEqual(valid.tabSuggestedLines, 50);
  assert.strictEqual(valid.tabAcceptedLines, 25);
  assert.strictEqual(valid.composerSuggestedLines, 100);
  assert.strictEqual(valid.composerAcceptedLines, 80);

  // Partial data with missing fields and string numbers
  const partial = parseDailyStats(
    JSON.stringify({
      date: "2026-08-20",
      tabSuggestedLines: "30",
      composerAcceptedLines: "45",
    })
  );
  assert.strictEqual(partial.date, "2026-08-20");
  assert.strictEqual(partial.tabSuggestedLines, 30);
  assert.strictEqual(partial.tabAcceptedLines, 0);
  assert.strictEqual(partial.composerSuggestedLines, 0);
  assert.strictEqual(partial.composerAcceptedLines, 45);

  // Invalid types and corrupted values
  const nonNumeric = parseDailyStats(
    JSON.stringify({
      date: 12345,
      tabSuggestedLines: "invalid",
      tabAcceptedLines: null,
      composerSuggestedLines: NaN,
      composerAcceptedLines: undefined,
    })
  );
  assert.strictEqual(nonNumeric.date, "12345");
  assert.strictEqual(nonNumeric.tabSuggestedLines, 0);
  assert.strictEqual(nonNumeric.tabAcceptedLines, 0);
  assert.strictEqual(nonNumeric.composerSuggestedLines, 0);
  assert.strictEqual(nonNumeric.composerAcceptedLines, 0);

  // Non-object and invalid JSON inputs
  assert.strictEqual(parseDailyStats(""), null);
  assert.strictEqual(parseDailyStats("invalid json string"), null);
  assert.strictEqual(parseDailyStats("123"), null);
  assert.strictEqual(parseDailyStats('"hello"'), null);
  assert.strictEqual(parseDailyStats("true"), null);
  assert.strictEqual(parseDailyStats("null"), null);
  assert.deepStrictEqual(parseDailyStats("[]"), {
    date: "",
    tabSuggestedLines: 0,
    tabAcceptedLines: 0,
    composerSuggestedLines: 0,
    composerAcceptedLines: 0,
  });
});

test("local store: parseModelConfig extracts active models, surface sorting, and latest used model", () => {
  const config = JSON.stringify({
    aiSettings: {
      teamId: 101,
      modelConfig: {
        "cmd-k": { modelName: "gpt-4o" },
        composer: { modelName: "claude-3-7-sonnet" },
        "quick-agent": { modelId: "deepseek-v3" },
        "background-composer": {
          selectedModels: [{ modelId: "grok-beta" }],
        },
        "custom-surface": { modelName: "custom-model" },
        ignoredDefault: { modelName: "default" },
        emptySurface: { modelName: "   " },
        invalidSurface: "not an object",
      },
      modelLastUsedAt: {
        "gpt-4o": "2026-08-20T10:00:00.000Z",
        "claude-3-7-sonnet": "2026-08-21T12:00:00.000Z",
        "deepseek-v3": "2026-08-19T08:00:00.000Z",
      },
    },
  });

  const parsed = parseModelConfig(config);
  assert.strictEqual(parsed.teamId, 101);
  assert.strictEqual(parsed.lastUsedModel, "claude-3-7-sonnet");

  // Surfaces should be sorted in preferred order: composer, cmd-k, quick-agent, background-composer, custom-surface
  assert.strictEqual(parsed.models.length, 5);
  assert.strictEqual(parsed.models[0].surface, "composer");
  assert.strictEqual(parsed.models[0].label, "Composer");
  assert.strictEqual(parsed.models[0].modelName, "claude-3-7-sonnet");

  assert.strictEqual(parsed.models[1].surface, "cmd-k");
  assert.strictEqual(parsed.models[1].label, "Inline");
  assert.strictEqual(parsed.models[1].modelName, "gpt-4o");

  assert.strictEqual(parsed.models[2].surface, "quick-agent");
  assert.strictEqual(parsed.models[2].label, "Agent");
  assert.strictEqual(parsed.models[2].modelName, "deepseek-v3");

  assert.strictEqual(parsed.models[3].surface, "background-composer");
  assert.strictEqual(parsed.models[3].label, "Background");
  assert.strictEqual(parsed.models[3].modelName, "grok-beta");

  assert.strictEqual(parsed.models[4].surface, "custom-surface");
  assert.strictEqual(parsed.models[4].label, "custom-surface"); // unmapped surface fallback
  assert.strictEqual(parsed.models[4].modelName, "custom-model");

  // Invalid JSON or missing structures
  const fallback = parseModelConfig("invalid-json");
  assert.deepStrictEqual(fallback, { models: [], lastUsedModel: null, teamId: null });

  const emptySettings = parseModelConfig(JSON.stringify({ aiSettings: null }));
  assert.deepStrictEqual(emptySettings, { models: [], lastUsedModel: null, teamId: null });
});

test("local store: formatRelativeTime accurately formats relative recency intervals", () => {
  const now = 1755780000000; // Fixed reference timestamp

  // Invalid inputs
  assert.strictEqual(formatRelativeTime(0, now), "");
  assert.strictEqual(formatRelativeTime(-1000, now), "");
  assert.strictEqual(formatRelativeTime(NaN, now), "");
  assert.strictEqual(formatRelativeTime(Infinity, now), "");

  // "just now" (< 60s or future)
  assert.strictEqual(formatRelativeTime(now, now), "just now");
  assert.strictEqual(formatRelativeTime(now - 30 * 1000, now), "just now");
  assert.strictEqual(formatRelativeTime(now + 10 * 1000, now), "just now");

  // Minutes (1m to 59m)
  assert.strictEqual(formatRelativeTime(now - 60 * 1000, now), "1m ago");
  assert.strictEqual(formatRelativeTime(now - 45 * 60 * 1000, now), "45m ago");

  // Hours (1h to 23h)
  assert.strictEqual(formatRelativeTime(now - 60 * 60 * 1000, now), "1h ago");
  assert.strictEqual(formatRelativeTime(now - 14 * 60 * 60 * 1000, now), "14h ago");

  // Days (>= 24h)
  assert.strictEqual(formatRelativeTime(now - 24 * 60 * 60 * 1000, now), "1d ago");
  assert.strictEqual(formatRelativeTime(now - 7 * 24 * 60 * 60 * 1000, now), "7d ago");
  assert.strictEqual(formatRelativeTime(now - 30 * 24 * 60 * 60 * 1000, now), "30d ago");
});

test("local store: parseComposerHeader handles mode resolution and missing properties", () => {
  const now = Date.now();

  // unifiedMode takes priority
  const headerUnified = JSON.stringify({
    name: "Refactor API client",
    unifiedMode: "agent",
    forceMode: "chat",
    totalLinesAdded: 52,
    totalLinesRemoved: 18,
  });
  const res1 = parseComposerHeader(headerUnified, { composerId: "sess-1", recency: now - 60000 }, now);
  assert.ok(res1);
  assert.strictEqual(res1.id, "sess-1");
  assert.strictEqual(res1.name, "Refactor API client");
  assert.strictEqual(res1.mode, "agent");
  assert.strictEqual(res1.recencyLabel, "1m ago");
  assert.strictEqual(res1.linesAdded, 52);
  assert.strictEqual(res1.linesRemoved, 18);

  // forceMode fallback
  const headerForce = JSON.stringify({
    name: "Quick edit",
    forceMode: "inline",
  });
  const res2 = parseComposerHeader(headerForce, { composerId: "sess-2", recency: now }, now);
  assert.ok(res2);
  assert.strictEqual(res2.mode, "inline");
  assert.strictEqual(res2.linesAdded, 0);
  assert.strictEqual(res2.linesRemoved, 0);

  // Default mode "agent" when neither mode is specified
  const headerDefault = JSON.stringify({
    name: "Default session",
  });
  const res3 = parseComposerHeader(headerDefault, { composerId: "sess-3", recency: now }, now);
  assert.ok(res3);
  assert.strictEqual(res3.mode, "agent");

  // Invalid JSON or blank name
  assert.strictEqual(parseComposerHeader("invalid-json", { composerId: "sess-4", recency: now }), null);
  assert.strictEqual(parseComposerHeader(JSON.stringify({ name: "" }), { composerId: "sess-5", recency: now }), null);
  assert.strictEqual(parseComposerHeader(JSON.stringify({ name: "   " }), { composerId: "sess-6", recency: now }), null);
});

test("local store: readLocalInsights handles missing DB, empty DB, multi-day stats, and corrupt values", () => {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    // Skip SQLite DB integration if node:sqlite is not available
    return;
  }

  const testDbPath = path.join(__dirname, `test-local-insights-${Date.now()}.vscdb`);

  try {
    // 1. Nonexistent DB returns emptyLocalInsights
    process.env.CURSOR_DB_PATH = path.join(__dirname, "nonexistent-db.vscdb");
    const missingDbResult = readLocalInsights();
    assert.deepStrictEqual(missingDbResult, emptyLocalInsights());

    // 2. Setup SQLite DB with edge-case tables and data
    const db = new DatabaseSync(testDbPath);
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

    // Multiple dailyStats rows (including today and past day)
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      `aiCodeTracking.dailyStats.v1.5.${todayKey}`,
      JSON.stringify({
        date: todayKey,
        tabSuggestedLines: 15,
        tabAcceptedLines: 5,
        composerSuggestedLines: 40,
        composerAcceptedLines: 35,
      })
    );

    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      "aiCodeTracking.dailyStats.v1.5.2026-08-01",
      JSON.stringify({
        date: "2026-08-01",
        tabSuggestedLines: 20,
        tabAcceptedLines: 10,
        composerSuggestedLines: 60,
        composerAcceptedLines: 50,
      })
    );

    // Corrupted dailyStats row (should be skipped gracefully)
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      "aiCodeTracking.dailyStats.v1.5.corrupted",
      "{ invalid-json-payload"
    );

    // Model config reactive storage
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
      JSON.stringify({
        aiSettings: {
          teamId: 88,
          modelConfig: {
            composer: { modelName: "claude-3-7-sonnet" },
            "cmd-k": { modelName: "default" },
          },
          modelLastUsedAt: { "claude-3-7-sonnet": "2026-08-21T15:00:00.000Z" },
        },
      })
    );

    // Team row (JSON format)
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      "cursorAuth/cachedTeam",
      JSON.stringify({ teamId: 88, name: "Engineering Core" })
    );

    // Stripe membership
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      "cursorAuth/stripeMembershipType",
      " business "
    );

    // Active session (valid)
    const now = Date.now();
    db.prepare(
      "INSERT INTO composerHeaders (composerId, workspaceId, recency, isArchived, isSubagent, value) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      "sess-valid-1",
      "ws-1",
      now - 5000,
      0,
      0,
      JSON.stringify({
        name: "Feature Auth",
        unifiedMode: "agent",
        totalLinesAdded: 30,
        totalLinesRemoved: 10,
      })
    );

    // Archived session (should be excluded by query)
    db.prepare(
      "INSERT INTO composerHeaders (composerId, workspaceId, recency, isArchived, isSubagent, value) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      "sess-archived",
      "ws-1",
      now - 1000,
      1,
      0,
      JSON.stringify({ name: "Archived Feature", unifiedMode: "agent" })
    );

    // Subagent session (should be excluded by query)
    db.prepare(
      "INSERT INTO composerHeaders (composerId, workspaceId, recency, isArchived, isSubagent, value) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      "sess-subagent",
      "ws-1",
      now - 2000,
      0,
      1,
      JSON.stringify({ name: "Subagent Task", unifiedMode: "agent" })
    );

    // Corrupted session value (should be skipped by parser)
    db.prepare(
      "INSERT INTO composerHeaders (composerId, workspaceId, recency, isArchived, isSubagent, value) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      "sess-corrupt",
      "ws-1",
      now - 3000,
      0,
      0,
      "{ corrupt json"
    );

    db.close();

    process.env.CURSOR_DB_PATH = testDbPath;
    const insights = readLocalInsights();

    // Aggregations: today (15+5+40+35) + 2026-08-01 (20+10+60+50) = suggested: 135, accepted: 100
    assert.strictEqual(insights.cycleSuggested, 135);
    assert.strictEqual(insights.cycleAccepted, 100);
    assert.strictEqual(insights.tabAccepted, 15);
    assert.strictEqual(insights.composerAccepted, 85);

    // Today's stats
    assert.ok(insights.today);
    assert.strictEqual(insights.today.tabSuggestedLines, 15);
    assert.strictEqual(insights.today.tabAcceptedLines, 5);
    assert.strictEqual(insights.today.composerSuggestedLines, 40);
    assert.strictEqual(insights.today.composerAcceptedLines, 35);

    // Model config
    assert.strictEqual(insights.models.length, 1);
    assert.strictEqual(insights.models[0].modelName, "claude-3-7-sonnet");
    assert.strictEqual(insights.lastUsedModel, "claude-3-7-sonnet");

    // Team and membership
    assert.strictEqual(insights.teamId, 88);
    assert.strictEqual(insights.teamName, "Engineering Core");
    assert.strictEqual(insights.membershipType, "business");

    // Filtered sessions (only sess-valid-1 should be included)
    assert.strictEqual(insights.sessions.length, 1);
    assert.strictEqual(insights.sessions[0].id, "sess-valid-1");
    assert.strictEqual(insights.sessions[0].name, "Feature Auth");
    assert.strictEqual(insights.sessions[0].linesAdded, 30);
    assert.strictEqual(insights.sessions[0].linesRemoved, 10);
  } finally {
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // ignore cleanup
    }
  }
});

test("local store: normalizeDailyStatsDate handles ISO timestamps and key suffixes", () => {
  const today = todayKey();
  assert.strictEqual(normalizeDailyStatsDate(today), today);
  assert.strictEqual(normalizeDailyStatsDate(`${today}T12:34:56.000Z`), today);
  assert.strictEqual(
    normalizeDailyStatsDate(Date.parse(`${today}T00:00:00.000Z`)),
    today
  );
  assert.strictEqual(normalizeDailyStatsDate(""), null);
});

test("local store: dailyStatsRowIsToday matches date in JSON or key", () => {
  const today = todayKey();
  const stats = {
    date: today,
    tabSuggestedLines: 1,
    tabAcceptedLines: 2,
    composerSuggestedLines: 3,
    composerAcceptedLines: 4,
  };
  assert.strictEqual(
    dailyStatsRowIsToday(`aiCodeTracking.dailyStats.v1.5.${today}`, stats, today),
    true
  );
  assert.strictEqual(
    dailyStatsRowIsToday("aiCodeTracking.dailyStats.v1.5", { ...stats, date: `${today}T00:00:00.000Z` }, today),
    true
  );
  assert.strictEqual(
    dailyStatsRowIsToday(
      "aiCodeTracking.dailyStats.v1.5.2026-08-01",
      { ...stats, date: "2026-08-01" },
      today
    ),
    false
  );
});

test("local store: readLocalInsights uses explicit product folder path", () => {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return;
  }

  const os = require("os");
  const productFolder = `ccm-test-product-${Date.now()}`;
  const productDir = path.join(os.homedir(), ".config", productFolder, "User", "globalStorage");
  const testDbPath = path.join(productDir, "state.vscdb");
  const prevDbPath = process.env.CURSOR_DB_PATH;
  delete process.env.CURSOR_DB_PATH;

  try {
    fs.mkdirSync(productDir, { recursive: true });
    const db = new DatabaseSync(testDbPath);
    db.exec("CREATE TABLE ItemTable (key TEXT, value TEXT);");
    const today = todayKey();
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      `aiCodeTracking.dailyStats.v1.5.${today}`,
      JSON.stringify({
        date: `${today}T08:00:00.000Z`,
        tabSuggestedLines: 0,
        tabAcceptedLines: 11,
        composerSuggestedLines: 0,
        composerAcceptedLines: 22,
      })
    );
    db.close();

    const insights = readLocalInsights(productFolder);
    assert.ok(insights.today);
    assert.strictEqual(insights.today.tabAcceptedLines, 11);
    assert.strictEqual(insights.today.composerAcceptedLines, 22);
    assert.strictEqual(insights.cycleAccepted, 33);
  } finally {
    if (prevDbPath === undefined) {
      delete process.env.CURSOR_DB_PATH;
    } else {
      process.env.CURSOR_DB_PATH = prevDbPath;
    }
    try {
      fs.rmSync(path.join(os.homedir(), ".config", productFolder), { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  }
});
