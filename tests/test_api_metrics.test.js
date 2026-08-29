const test = require("node:test");
const assert = require("node:assert/strict");

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
  isLimitExceeded,
  formatCycleDate,
  estimateDaysLeft,
  buildBudgetMetrics,
  buildFeatureList,
  validateUsageSummary,
  validateStripeProfile,
} = require("../packages/shared/src/cursorApi.ts");

const {
  formatStatusBarText,
  formatStatusBarTooltip,
  serializeWebviewBootSnapshot,
} = require("../src/dashboardView.ts");

const {
  escapeHtml,
  money,
  formatFeaturePercent,
  generateNonce,
} = require("../src/utils.ts");

test("utils: escapeHtml correctly sanitizes special characters", () => {
  assert.strictEqual(escapeHtml("<script>alert('xss')</script>"), "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  assert.strictEqual(escapeHtml("a & b \"c\""), "a &amp; b &quot;c&quot;");
  assert.strictEqual(escapeHtml(null), "");
  assert.strictEqual(escapeHtml(undefined), "");
});

test("utils: money formats USD amounts safely", () => {
  assert.strictEqual(money(0), "$0.00");
  assert.strictEqual(money(25.5), "$25.50");
  assert.strictEqual(money(1234.56), "$1,234.56");
  assert.strictEqual(money(NaN), "$0.00");
  assert.strictEqual(money(Infinity), "$0.00");
});

test("utils: formatFeaturePercent formats numbers safely", () => {
  assert.strictEqual(formatFeaturePercent(0), "0");
  assert.strictEqual(formatFeaturePercent(12.3456), "12.35");
  assert.strictEqual(formatFeaturePercent(99.9), "99.9");
  assert.strictEqual(formatFeaturePercent(NaN), "0");
});

test("utils: generateNonce generates unique base64 strings", () => {
  const nonce1 = generateNonce();
  const nonce2 = generateNonce();
  assert.ok(nonce1 && typeof nonce1 === "string");
  assert.ok(nonce2 && typeof nonce2 === "string");
  assert.notStrictEqual(nonce1, nonce2);
  assert.ok(nonce1.length >= 16);
});

test("cursorApi: validateUsageSummary parses valid payload and rejects invalid shapes", () => {
  assert.throws(() => validateUsageSummary(null));
  assert.throws(() => validateUsageSummary("not an object"));
  assert.throws(() => validateUsageSummary({}));
  assert.throws(() => validateUsageSummary({ individualUsage: {} }));

  const valid = {
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
      },
      onDemand: {
        enabled: false,
        used: 0,
        limit: null,
        remaining: null,
      },
    },
  };

  const parsed = validateUsageSummary(valid);
  assert.strictEqual(parsed.membershipType, "Pro");
  assert.strictEqual(parsed.individualUsage.plan.used, 100);
});

test("cursorApi: validateStripeProfile parses profile safely", () => {
  assert.throws(() => validateStripeProfile(null));
  const parsed = validateStripeProfile({
    membershipType: "Team",
    isTeamMember: true,
    teamId: 42,
  });
  assert.strictEqual(parsed.membershipType, "Team");
  assert.strictEqual(parsed.isTeamMember, true);
  assert.strictEqual(parsed.teamId, 42);
});

test("cursorApi: isLimitExceeded correctly identifies limit boundaries", () => {
  const baseSummary = {
    billingCycleStart: "2026-08-01T00:00:00Z",
    billingCycleEnd: "2026-09-01T00:00:00Z",
    membershipType: "Pro",
    limitType: "Monthly",
    isUnlimited: false,
    individualUsage: {
      plan: {
        enabled: true,
        used: 50,
        limit: 500,
        remaining: 450,
        autoPercentUsed: 10,
        apiPercentUsed: 5,
        totalPercentUsed: 10,
      },
      onDemand: {
        enabled: false,
        used: 0,
        limit: null,
        remaining: null,
      },
    },
  };

  assert.strictEqual(isLimitExceeded(baseSummary), false);

  const exceeded1 = JSON.parse(JSON.stringify(baseSummary));
  exceeded1.individualUsage.plan.totalPercentUsed = 100;
  exceeded1.individualUsage.plan.remaining = 0;
  exceeded1.individualUsage.plan.used = 500;
  assert.strictEqual(isLimitExceeded(exceeded1), true);

  const bonusStillAvailable = JSON.parse(JSON.stringify(baseSummary));
  bonusStillAvailable.individualUsage.plan.used = 2000;
  bonusStillAvailable.individualUsage.plan.limit = 2000;
  bonusStillAvailable.individualUsage.plan.remaining = 0;
  bonusStillAvailable.individualUsage.plan.totalPercentUsed = 100;
  bonusStillAvailable.individualUsage.plan.breakdown = {
    included: 2000,
    bonus: 12420,
    total: 14420,
  };
  assert.strictEqual(isLimitExceeded(bonusStillAvailable), false);

  const exceeded2 = JSON.parse(JSON.stringify(baseSummary));
  exceeded2.individualUsage.plan.remaining = 0;
  exceeded2.individualUsage.plan.used = 500;
  assert.strictEqual(isLimitExceeded(exceeded2), true);

  const exceeded3 = JSON.parse(JSON.stringify(baseSummary));
  exceeded3.autoModelSelectedDisplayMessage = "Usage is at 100%";
  exceeded3.individualUsage.plan.remaining = 0;
  exceeded3.individualUsage.plan.used = 500;
  assert.strictEqual(isLimitExceeded(exceeded3), true);
});

test("cursorApi: formatCycleDate and estimateDaysLeft handle various inputs", () => {
  assert.strictEqual(formatCycleDate("invalid-date"), "Invalid Date");
  assert.strictEqual(estimateDaysLeft("invalid-date"), 0);

  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const days = estimateDaysLeft(future);
  assert.ok(days >= 4 && days <= 6);
});

test("cursorApi: buildBudgetMetrics calculates plan and custom USD budgets accurately", () => {
  const summary = {
    billingCycleStart: "2026-08-01T00:00:00Z",
    billingCycleEnd: "2026-09-01T00:00:00Z",
    membershipType: "Pro",
    limitType: "Monthly",
    isUnlimited: false,
    individualUsage: {
      plan: {
        enabled: true,
        used: 250,
        limit: 500,
        remaining: 250,
        autoPercentUsed: 50,
        apiPercentUsed: 25,
        totalPercentUsed: 50,
      },
      onDemand: {
        enabled: true,
        used: 500, // $5.00
        limit: 2000, // $20.00
        remaining: 1500,
      },
    },
  };

  const metricsPlan = buildBudgetMetrics(summary, 0, 5, 80, false);
  assert.strictEqual(metricsPlan.hasUsdBudget, true);
  assert.strictEqual(metricsPlan.capUsd, 20);
  assert.strictEqual(metricsPlan.spentUsd, 5);
  assert.strictEqual(metricsPlan.leftUsd, 15);
  assert.strictEqual(metricsPlan.thresholdReached, false);

  const metricsCustom = buildBudgetMetrics(summary, 10, 8.5, 80, false);
  assert.strictEqual(metricsCustom.capUsd, 10);
  assert.strictEqual(metricsCustom.spentUsd, 8.5);
  assert.strictEqual(metricsCustom.thresholdReached, true);
});

test("dashboardView: formatStatusBarText and formatStatusBarTooltip output correct content", () => {
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    email: "test@example.com",
    usage: {
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
          autoPercentUsed: 20.5,
          apiPercentUsed: 15.25,
          totalPercentUsed: 20,
        },
        onDemand: { enabled: false, used: 0, limit: null, remaining: null },
      },
    },
    profile: null,
    fallbackApplied: false,
    limitExceeded: false,
    customBudgetLimit: 0,
    onDemandSpendUsd: 0,
    budget: {
      percentUsed: 20,
      includedPercent: 20,
      includedUsed: 100,
      includedLimit: 500,
      includedRemaining: 400,
      autoPercentUsed: 20.5,
      apiPercentUsed: 15.25,
      capUsd: 0,
      spentUsd: 0,
      leftUsd: 0,
      budgetPercentUsed: 0,
      thresholdPercent: 80,
      thresholdReached: false,
      limitExceeded: false,
      daysUntilReset: 15,
      resetDateLabel: "Sep 1, 2026",
      cycleStartLabel: "Aug 1, 2026",
      cycleEndLabel: "Sep 1, 2026",
      onDemandEnabled: false,
      onDemandCapUsd: null,
      onDemandRemainingUsd: null,
      hasUsdBudget: false,
      usdBudgetActive: false,
      planBreakdownIncluded: 100,
      planBreakdownBonus: 0,
      planBreakdownTotal: 500,
      teamOnDemandEnabled: false,
      teamOnDemandSpendUsd: null,
    },
    features: [],
  };

  const autoApiText = formatStatusBarText(snapshot, "autoApi");
  assert.ok(autoApiText.includes("Auto 20.5% · API 15.3%"));

  const planText = formatStatusBarText(snapshot, "plan");
  assert.ok(planText.includes("Usage: 20%"));

  const bothText = formatStatusBarText(snapshot, "both");
  assert.ok(bothText.includes("Usage: 20%") && bothText.includes("Auto 20.5% · API 15.3%"));

  const tooltip = formatStatusBarTooltip(snapshot);
  assert.ok(tooltip.includes("Plan: 20%"));
  assert.ok(tooltip.includes("Auto: 20.5%"));
  assert.ok(tooltip.includes("API: 15.3%"));
});

test("dashboardView: serializeWebviewBootSnapshot escapes HTML and serializes null", () => {
  assert.equal(serializeWebviewBootSnapshot(undefined), "null");
  const encoded = serializeWebviewBootSnapshot({
    fetchedAt: "2026-08-27T00:00:00.000Z",
    email: "a<b>&c",
    usage: null,
    profile: null,
    fallbackApplied: false,
    limitExceeded: false,
    customBudgetLimit: 0,
    onDemandSpendUsd: 0,
    budget: null,
    features: ["Auto <script>"],
  });
  assert.equal(encoded.includes("<"), false);
  assert.equal(encoded.includes(">"), false);
  assert.ok(encoded.includes("\\u003c"));
  assert.ok(encoded.includes("\\u003e"));
  assert.ok(encoded.includes("\\u0026"));
});
