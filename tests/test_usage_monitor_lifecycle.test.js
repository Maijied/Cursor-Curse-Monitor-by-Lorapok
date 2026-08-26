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

const vscode = require("./mock-vscode.js");
const { UsageMonitorService } = require("../src/usageMonitor.ts");

function createMockContext() {
  const state = new Map();
  return {
    subscriptions: [],
    globalState: {
      get: (key, fallback) => (state.has(key) ? state.get(key) : fallback),
      update: (key, value) => {
        state.set(key, value);
        return Promise.resolve();
      },
    },
  };
}

function createSampleUsage(overrides = {}) {
  return {
    billingCycleStart: "2026-08-01T00:00:00Z",
    billingCycleEnd: "2026-09-01T00:00:00Z",
    membershipType: "Pro",
    limitType: "Monthly",
    isUnlimited: false,
    individualUsage: {
      plan: {
        enabled: true,
        used: 100,
        limit: 500,
        remaining: 400,
        autoPercentUsed: 20,
        apiPercentUsed: 10,
        totalPercentUsed: 20,
        ...(overrides.plan || {}),
      },
      onDemand: {
        enabled: false,
        used: 0,
        limit: null,
        remaining: null,
        ...(overrides.onDemand || {}),
      },
    },
    ...overrides,
  };
}

function createSampleProfile(overrides = {}) {
  return {
    membershipType: "Pro",
    isTeamMember: false,
    ...overrides,
  };
}

function setupMockDb(dbPath, { hasToken = true, hasEmail = true, hasReactive = true } = {}) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return false;
  }

  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    // ignore
  }

  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE ItemTable (key TEXT, value TEXT);");
  if (hasToken) {
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run("cursorAuth/accessToken", "test-valid-jwt-token");
  }
  if (hasEmail) {
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run("cursorAuth/cachedEmail", "test@lorapok.tech");
  }
  if (hasReactive) {
    db.prepare("INSERT INTO ItemTable VALUES (?, ?)").run(
      "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser",
      JSON.stringify({
        aiSettings: {
          modelConfig: { composer: { modelName: "composer-2.5" } },
        },
      })
    );
  }
  db.close();
  return true;
}

test("usage monitor: debouncing cooldown returns cached snapshot within 3000ms unless force=true", async () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(__dirname, `mock-monitor-debounce-${Date.now()}.vscdb`);

  if (!setupMockDb(dbPath)) {
    return;
  }

  process.env.CURSOR_DB_PATH = dbPath;
  vscode._reset();

  let fetchCallCount = 0;
  global.fetch = async (url) => {
    fetchCallCount++;
    if (url.includes("/usage-summary")) {
      return { ok: true, json: async () => createSampleUsage() };
    }
    if (url.includes("/full_stripe_profile")) {
      return { ok: true, json: async () => createSampleProfile() };
    }
    return { ok: false, status: 404 };
  };

  const context = createMockContext();
  const service = new UsageMonitorService(context);

  try {
    // Initial refresh -> triggers fetch
    const snapshot1 = await service.refresh();
    assert.strictEqual(fetchCallCount, 2); // 1 usage + 1 profile
    assert.strictEqual(snapshot1.limitExceeded, false);

    // Immediate second refresh (< 3000ms, force = false) -> should return cached snapshot without network call
    const snapshot2 = await service.refresh(false);
    assert.strictEqual(fetchCallCount, 2); // Unchanged
    assert.strictEqual(snapshot1, snapshot2); // Exact reference equality

    // Forced refresh -> bypasses cooldown and makes fresh fetch
    const snapshot3 = await service.refresh(true);
    assert.strictEqual(fetchCallCount, 4); // 2 more fetches
    assert.ok(snapshot3.fetchedAt);
  } finally {
    global.fetch = originalFetch;
    service.dispose();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }
});

test("usage monitor: in-flight request sharing deduplicates concurrent refresh calls", async () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(__dirname, `mock-monitor-inflight-${Date.now()}.vscdb`);

  if (!setupMockDb(dbPath)) {
    return;
  }

  process.env.CURSOR_DB_PATH = dbPath;
  vscode._reset();

  let fetchCallCount = 0;
  global.fetch = async (url) => {
    fetchCallCount++;
    // Add artificial delay to ensure concurrency window
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (url.includes("/usage-summary")) {
      return { ok: true, json: async () => createSampleUsage() };
    }
    if (url.includes("/full_stripe_profile")) {
      return { ok: true, json: async () => createSampleProfile() };
    }
    return { ok: false, status: 404 };
  };

  const context = createMockContext();
  const service = new UsageMonitorService(context);

  try {
    // Launch 4 simultaneous refresh requests with force=true on first to ensure execution
    const [s1, s2, s3, s4] = await Promise.all([
      service.refresh(true),
      service.refresh(),
      service.refresh(),
      service.refresh(),
    ]);

    // All callers should share the same in-flight Promise and receive the exact same snapshot reference
    assert.strictEqual(fetchCallCount, 2);
    assert.strictEqual(s1, s2);
    assert.strictEqual(s2, s3);
    assert.strictEqual(s3, s4);
    assert.strictEqual(service.getSnapshot(), s1);
  } finally {
    global.fetch = originalFetch;
    service.dispose();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }
});

test("usage monitor: forced refresh after in-flight completes picks up updated config", async () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(__dirname, `mock-monitor-force-after-inflight-${Date.now()}.vscdb`);

  if (!setupMockDb(dbPath)) {
    return;
  }

  process.env.CURSOR_DB_PATH = dbPath;
  vscode._reset();
  vscode._setConfig("cursorCurseMonitor", { customBudgetLimit: 10, warnAtPercent: 80 });

  let fetchCallCount = 0;
  global.fetch = async (url) => {
    fetchCallCount++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (url.includes("/usage-summary")) {
      return { ok: true, json: async () => createSampleUsage() };
    }
    if (url.includes("/full_stripe_profile")) {
      return { ok: true, json: async () => createSampleProfile() };
    }
    return { ok: false, status: 404 };
  };

  const context = createMockContext();
  const service = new UsageMonitorService(context);

  try {
    const inFlight = service.refresh(true);
    vscode._setConfig("cursorCurseMonitor", { customBudgetLimit: 99 });
    const afterMutation = await service.refresh(true);
    const first = await inFlight;

    assert.strictEqual(first.customBudgetLimit, 10);
    assert.strictEqual(afterMutation.customBudgetLimit, 99);
    assert.strictEqual(fetchCallCount, 4);
  } finally {
    global.fetch = originalFetch;
    service.dispose();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }
});

test("usage monitor: listener dispatch, subscription lifecycle, and immediate replay", async () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(__dirname, `mock-monitor-listener-${Date.now()}.vscdb`);

  if (!setupMockDb(dbPath)) {
    return;
  }

  process.env.CURSOR_DB_PATH = dbPath;
  vscode._reset();

  global.fetch = async (url) => {
    if (url.includes("/usage-summary")) {
      return { ok: true, json: async () => createSampleUsage() };
    }
    if (url.includes("/full_stripe_profile")) {
      return { ok: true, json: async () => createSampleProfile() };
    }
    return { ok: false, status: 404 };
  };

  const context = createMockContext();
  const service = new UsageMonitorService(context);

  try {
    const listener1Events = [];
    const listener2Events = [];

    // Register listener 1 before initial refresh
    const sub1 = service.onDidUpdate((s) => listener1Events.push(s));
    assert.strictEqual(listener1Events.length, 0);

    // Initial refresh
    const initialSnapshot = await service.refresh();
    assert.strictEqual(listener1Events.length, 1);
    assert.strictEqual(listener1Events[0], initialSnapshot);

    // Register listener 2 after snapshot exists -> should receive immediate replay of last snapshot
    const sub2 = service.onDidUpdate((s) => listener2Events.push(s));
    assert.strictEqual(listener2Events.length, 1);
    assert.strictEqual(listener2Events[0], initialSnapshot);

    // Dispose listener 1, trigger forced refresh
    sub1.dispose();
    const secondSnapshot = await service.refresh(true);

    // Listener 1 should have received nothing new, listener 2 should receive the update
    assert.strictEqual(listener1Events.length, 1);
    assert.strictEqual(listener2Events.length, 2);
    assert.strictEqual(listener2Events[1], secondSnapshot);

    // Dispose listener 2
    sub2.dispose();
  } finally {
    global.fetch = originalFetch;
    service.dispose();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }
});

test("usage monitor: error states handle missing DB, missing token, and API failure gracefully", async () => {
  const originalFetch = global.fetch;
  const context = createMockContext();
  vscode._reset();

  // 1. Missing DB
  process.env.CURSOR_DB_PATH = path.join(__dirname, "nonexistent-monitor-db.vscdb");
  const serviceMissingDb = new UsageMonitorService(context);
  const snapshotMissingDb = await serviceMissingDb.refresh();
  assert.strictEqual(snapshotMissingDb.cursorMissing, true);
  assert.ok(snapshotMissingDb.error && snapshotMissingDb.error.includes("Cursor storage database not found"));
  serviceMissingDb.dispose();

  // 2. DB exists but Auth Token is missing
  const noTokenDbPath = path.join(__dirname, `mock-no-token-${Date.now()}.vscdb`);
  if (setupMockDb(noTokenDbPath, { hasToken: false })) {
    process.env.CURSOR_DB_PATH = noTokenDbPath;
    const serviceNoToken = new UsageMonitorService(context);
    const snapshotNoToken = await serviceNoToken.refresh();
    assert.strictEqual(snapshotNoToken.cursorMissing, false);
    assert.ok(snapshotNoToken.error && snapshotNoToken.error.includes("Cursor auth token not found"));
    serviceNoToken.dispose();
    try {
      if (fs.existsSync(noTokenDbPath)) fs.unlinkSync(noTokenDbPath);
    } catch {}
  }

  // 3. API Network Failure (HTTP 500)
  const validDbPath = path.join(__dirname, `mock-api-fail-${Date.now()}.vscdb`);
  if (setupMockDb(validDbPath, { hasToken: true })) {
    process.env.CURSOR_DB_PATH = validDbPath;
    global.fetch = async () => ({ ok: false, status: 500 });
    const serviceApiFail = new UsageMonitorService(context);
    const snapshotApiFail = await serviceApiFail.refresh();
    assert.ok(snapshotApiFail.error && snapshotApiFail.error.includes("Usage API failed (500)"));
    serviceApiFail.dispose();
    try {
      if (fs.existsSync(validDbPath)) fs.unlinkSync(validDbPath);
    } catch {}
  }

  global.fetch = originalFetch;
});

test("usage monitor: threshold warning alerting state machine prevents duplicate toasts", async () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(__dirname, `mock-monitor-alerting-${Date.now()}.vscdb`);

  if (!setupMockDb(dbPath)) {
    return;
  }

  process.env.CURSOR_DB_PATH = dbPath;
  vscode._reset();
  vscode._setConfig("cursorCurseMonitor", { warnAtPercent: 80 });

  let currentUsagePercent = 50;
  global.fetch = async (url) => {
    if (url.includes("/usage-summary")) {
      return {
        ok: true,
        json: async () =>
          createSampleUsage({
            plan: {
              enabled: true,
              used: currentUsagePercent * 5,
              limit: 500,
              remaining: 500 - currentUsagePercent * 5,
              totalPercentUsed: currentUsagePercent,
              autoPercentUsed: currentUsagePercent,
              apiPercentUsed: currentUsagePercent / 2,
            },
          }),
      };
    }
    if (url.includes("/full_stripe_profile")) {
      return { ok: true, json: async () => createSampleProfile() };
    }
    return { ok: false, status: 404 };
  };

  const context = createMockContext();
  const service = new UsageMonitorService(context);

  try {
    // Step 1: Usage at 50% (< 80%) -> No warning notification
    currentUsagePercent = 50;
    await service.refresh(true);
    let toasts = vscode._getNotifications();
    assert.strictEqual(toasts.length, 0);

    // Step 2: Usage reaches 85% (>= 80% and < 100%) -> Triggers warning notification
    currentUsagePercent = 85;
    await service.refresh(true);
    toasts = vscode._getNotifications();
    assert.strictEqual(toasts.length, 1);
    assert.strictEqual(toasts[0].type, "warning");
    assert.ok(toasts[0].text.includes("Usage Warning"));

    // Step 3: Next refresh still at 90% (>= 80% and < 100%) -> State latch prevents duplicate toast
    currentUsagePercent = 90;
    await service.refresh(true);
    toasts = vscode._getNotifications();
    assert.strictEqual(toasts.length, 1); // Still 1, no duplicate added

    // Step 4: Usage drops to 40% (< 80%) -> Reset latch
    currentUsagePercent = 40;
    await service.refresh(true);
    toasts = vscode._getNotifications();
    assert.strictEqual(toasts.length, 1); // Still 1

    // Step 5: Usage rises back to 85% -> Re-triggers warning notification
    currentUsagePercent = 85;
    await service.refresh(true);
    toasts = vscode._getNotifications();
    assert.strictEqual(toasts.length, 2); // Second warning toast recorded!
  } finally {
    global.fetch = originalFetch;
    service.dispose();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }
});

test("usage monitor: automatic fallback trigger on limit exceeded state machine", async () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(__dirname, `mock-monitor-fallback-${Date.now()}.vscdb`);

  if (!setupMockDb(dbPath)) {
    return;
  }

  process.env.CURSOR_DB_PATH = dbPath;
  process.env.CURSOR_EDITOR_RUNNING = "0"; // Allow fallback write
  vscode._reset();
  vscode._setConfig("cursorCurseMonitor", { autoApplyFallbackModel: true, warnAtPercent: 80 });

  let isExceeded = false;
  global.fetch = async (url) => {
    if (url.includes("/usage-summary")) {
      return {
        ok: true,
        json: async () =>
          createSampleUsage({
            plan: {
              enabled: true,
              used: isExceeded ? 500 : 250,
              limit: 500,
              remaining: isExceeded ? 0 : 250,
              totalPercentUsed: isExceeded ? 100 : 50,
            },
          }),
      };
    }
    if (url.includes("/full_stripe_profile")) {
      return { ok: true, json: async () => createSampleProfile() };
    }
    return { ok: false, status: 404 };
  };

  const context = createMockContext();
  const service = new UsageMonitorService(context);

  try {
    // 1. Refresh when limit not exceeded
    isExceeded = false;
    const snap1 = await service.refresh(true);
    assert.strictEqual(snap1.limitExceeded, false);
    assert.strictEqual(snap1.fallbackApplied, false);

    // 2. Limit exceeded -> Auto applies fallback model and records fallbackApplied: true
    isExceeded = true;
    const snap2 = await service.refresh(true);
    assert.strictEqual(snap2.limitExceeded, true);
    assert.strictEqual(snap2.fallbackApplied, true);

    // Verify history point was recorded into context globalState
    const history = context.globalState.get("usageHistoryV1", []);
    assert.ok(history.length >= 1);
    assert.strictEqual(history[history.length - 1].includedPercent, 100);
  } finally {
    global.fetch = originalFetch;
    service.dispose();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }
});

test("usage monitor: start, schedule configuration listener, and dispose lifecycle", async () => {
  const originalFetch = global.fetch;
  const dbPath = path.join(__dirname, `mock-monitor-sched-${Date.now()}.vscdb`);

  if (!setupMockDb(dbPath)) {
    return;
  }

  process.env.CURSOR_DB_PATH = dbPath;
  vscode._reset();
  vscode._setConfig("cursorCurseMonitor", { pollIntervalSeconds: 30 });

  global.fetch = async (url) => {
    if (url.includes("/usage-summary")) {
      return { ok: true, json: async () => createSampleUsage() };
    }
    if (url.includes("/full_stripe_profile")) {
      return { ok: true, json: async () => createSampleProfile() };
    }
    return { ok: false, status: 404 };
  };

  const context = createMockContext();
  const service = new UsageMonitorService(context);

  try {
    service.start();
    assert.strictEqual(context.subscriptions.length, 1);

    // Trigger config change event for pollIntervalSeconds
    vscode._setConfig("cursorCurseMonitor", { pollIntervalSeconds: 15 });
    vscode._fireConfigChange("cursorCurseMonitor.pollIntervalSeconds");

    // Ensure dispose clears timers and listeners cleanly
    service.dispose();
  } finally {
    global.fetch = originalFetch;
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }
});
