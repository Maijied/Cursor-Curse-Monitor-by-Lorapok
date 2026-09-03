import assert from "node:assert/strict";
import { buildStackedAreaGeometry, formatCompactCount } from "../dist/usageChart.js";

assert.equal(formatCompactCount(662_300_000), "662.3M");
assert.equal(formatCompactCount(120_600), "120.6K");
assert.equal(formatCompactCount(42), "42");
assert.equal(formatCompactCount(NaN), "—");

const geom = buildStackedAreaGeometry(
  [
    { id: "a", label: "A", color: "#f00", values: [10, 20, 30] },
    { id: "b", label: "B", color: "#0f0", values: [5, 10, 15] },
  ],
  3,
  { yMax: 50 }
);
assert.ok(geom);
assert.equal(geom.paths.length, 2);
assert.ok(geom.paths[0].areaD.startsWith("M "));
assert.equal(geom.tops.length, 3);
assert.equal(geom.tops[2].total, 45);

assert.equal(buildStackedAreaGeometry([], 2), null);

console.log("usageChart.test.mjs: OK");
