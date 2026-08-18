import assert from "node:assert";

const { buildBudgetMetrics } = await import(
  "../../packages/shared/dist/cursorApi.js"
).catch(async () => {
  require("ts-node").register({ transpileOnly: true });
  return import("../../packages/shared/src/cursorApi.ts");
});

const usage = {
  billingCycleStart: "2026-08-01T00:00:00.000Z",
  billingCycleEnd: "2026-08-31T00:00:00.000Z",
  membershipType: "pro",
  limitType: "user",
  isUnlimited: false,
  individualUsage: {
    plan: {
      enabled: true,
      used: 810,
      limit: 1000,
      remaining: 190,
      autoPercentUsed: 81,
      apiPercentUsed: 40,
      totalPercentUsed: 81,
    },
    onDemand: { enabled: false, used: 0, limit: null, remaining: null },
  },
};

const b = buildBudgetMetrics(usage, 1000, 812.45, 80, false);
assert.equal(Math.round(b.percentUsed), 81);
assert(b.hasUsdBudget);
console.log("test_shared.js: OK");
