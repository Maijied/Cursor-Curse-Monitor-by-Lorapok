const assert = require("assert");

async function run() {
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
    buildBudgetMetrics,
    formatPercent,
    appendUsageHistory,
    buildFeatureList,
  } = require("../packages/shared/src/cursorApi.ts");

  const usage = {
    billingCycleStart: "2026-08-15T00:00:00.000Z",
    billingCycleEnd: "2026-09-15T00:00:00.000Z",
    membershipType: "enterprise",
    limitType: "team",
    isUnlimited: false,
    individualUsage: {
      plan: {
        enabled: true,
        used: 9093,
        limit: 9093,
        remaining: 0,
        breakdown: { included: 2000, bonus: 7093, total: 9093 },
        autoPercentUsed: 35.23571428571429,
        apiPercentUsed: 100,
        totalPercentUsed: 0,
      },
      onDemand: { enabled: false, used: 0, limit: null, remaining: null },
    },
  };

  const metrics = buildBudgetMetrics(usage, 80, 0, 80, true);
  assert.strictEqual(metrics.hasUsdBudget, true, "personal cap still recorded");
  assert.strictEqual(metrics.usdBudgetActive, false, "unused USD cap must not be active");
  assert.ok(metrics.percentUsed >= 100, "hero percent must follow exhausted quota / API 100%");
  assert.strictEqual(metrics.includedRemaining, 0);
  assert.ok(metrics.budgetPercentUsed < 1, "USD spend percent stays ~0 when on-demand is off");

  const features = buildFeatureList(usage, { membershipType: "enterprise", isTeamMember: true, teamId: 12671157 });
  const autoChip = features.find((f) => f.startsWith("Auto "));
  assert.ok(autoChip.includes("35.2%"), `Auto/API chip should be rounded, got ${autoChip}`);
  assert.ok(!autoChip.includes("35.235714"), "raw float must not appear in chips");
  assert.strictEqual(formatPercent(35.23571428571429), "35.2");

  const bonusHeadroom = {
    billingCycleStart: "2026-08-15T00:00:00.000Z",
    billingCycleEnd: "2026-09-23T00:00:00.000Z",
    membershipType: "pro",
    limitType: "user",
    isUnlimited: false,
    individualUsage: {
      plan: {
        enabled: true,
        used: 2000,
        limit: 2000,
        remaining: 0,
        breakdown: { included: 2000, bonus: 12420, total: 14420 },
        autoPercentUsed: 25.4,
        apiPercentUsed: 66.7,
        totalPercentUsed: 13.9,
      },
      onDemand: { enabled: false, used: 0, limit: null, remaining: null },
    },
  };
  const bonusMetrics = buildBudgetMetrics(bonusHeadroom, 20, 0, 80, false);
  assert.strictEqual(bonusMetrics.includedRemaining, 12420, "bonus units count toward remaining");
  assert.strictEqual(bonusMetrics.includedLimit, 14420, "total pool includes bonus");
  assert.strictEqual(bonusMetrics.bonusRemaining, 12420);
  assert.strictEqual(bonusMetrics.bonusUsed, 0);
  assert.strictEqual(bonusMetrics.bonusLabel, "Agent credits");
  assert.ok(bonusMetrics.percentUsed < 100, "hero percent must not claim 100% when bonus remains");
  assert.strictEqual(bonusMetrics.usdBudgetActive, false, "personal cap is inactive without on-demand spend");

  const first = { t: 1_000, includedPercent: 10, auto: 10, api: 10, spentUsd: 0 };
  const sameSoon = { t: 1_000 + 60_000, includedPercent: 10.2, auto: 10.1, api: 10, spentUsd: 0 };
  const jumped = { t: 1_000 + 120_000, includedPercent: 40, auto: 12, api: 40, spentUsd: 0 };
  const kept = appendUsageHistory([first], sameSoon);
  assert.strictEqual(kept.length, 1, "near-duplicate samples within interval are dropped");
  const withJump = appendUsageHistory(kept, jumped);
  assert.strictEqual(withJump.length, 2, "material jumps are stored immediately");

  console.log("budget-metrics test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
