import assert from "node:assert/strict";
import { buildUsageAnalytics, buildUsageKpi } from "../dist/usageAnalytics.js";

const now = Date.now();
const history = [
  { t: now - 3 * 86400000, auto: 20, api: 10, includedPercent: 30 },
  { t: now - 2 * 86400000, auto: 35, api: 15, includedPercent: 50 },
  { t: now - 1 * 86400000, auto: 45, api: 25, includedPercent: 70 },
  { t: now, auto: 55, api: 30, includedPercent: 85 },
];

const budget = {
  percentUsed: 72,
  budgetPercentUsed: 72,
  usdBudgetActive: false,
  spentUsd: 0,
  capUsd: 0,
  includedUsed: 1200,
  includedLimit: 2000,
  onDemandEnabled: false,
};

const usage = {
  billingCycleStart: new Date(now - 10 * 86400000).toISOString(),
  individualUsage: { onDemand: { used: 0 } },
};

const kpi = buildUsageKpi(budget, usage, 0);
assert.equal(kpi.totalValue, "72%");
assert.match(kpi.includedValue, /1,200/);

const autoApi = buildUsageAnalytics({ budget, usage, history });
assert.ok(autoApi);
assert.equal(autoApi.groupBy, "autoApi");
assert.equal(autoApi.points.length, 4);
assert.equal(autoApi.layers.length, 2);
assert.equal(autoApi.layers[0].id, "auto");
assert.equal(autoApi.layers[1].id, "api");
assert.equal(autoApi.layers[0].values[3], 55);

const day = (offsetDays) => {
  const d = new Date(now - offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
};

const surface = buildUsageAnalytics({
  budget,
  usage,
  history,
  dailySeries: [
    { date: day(3), tabAcceptedLines: 10, composerAcceptedLines: 5 },
    { date: day(2), tabAcceptedLines: 20, composerAcceptedLines: 8 },
    { date: day(1), tabAcceptedLines: 15, composerAcceptedLines: 12 },
  ],
  groupBy: "surface",
  range: "7d",
});
assert.ok(surface);
assert.equal(surface.groupBy, "surface");
assert.equal(surface.yUnit, "lines");
assert.equal(surface.layers[0].id, "tab");

const empty = buildUsageAnalytics({ budget, usage, history: [history[0]] });
assert.ok(empty);
assert.equal(empty.points.length, 0);
assert.match(empty.emptyMessage ?? "", /Trend builds/);

const stacked = buildUsageAnalytics({
  budget,
  usage,
  history: [
    { t: now - 86400000, auto: 60, api: 50, includedPercent: 70 },
    { t: now, auto: 70, api: 45, includedPercent: 85 },
  ],
});
assert.ok(stacked);
assert.equal(stacked.yMax, 115);

const surfaceMissing = buildUsageAnalytics({ budget, usage, history, groupBy: "surface" });
assert.ok(surfaceMissing);
assert.equal(surfaceMissing.groupBy, "surface");
assert.equal(surfaceMissing.points.length, 0);
assert.match(surfaceMissing.emptyMessage ?? "", /daily stats/i);

const modelMissing = buildUsageAnalytics({ budget, usage, history, groupBy: "model" });
assert.ok(modelMissing);
assert.equal(modelMissing.groupBy, "model");
assert.equal(modelMissing.points.length, 0);
assert.match(modelMissing.emptyMessage ?? "", /model breakdown/i);

console.log("usageAnalytics.test.mjs: OK");
