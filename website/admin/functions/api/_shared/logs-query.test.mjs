#!/usr/bin/env node
import assert from "node:assert/strict";
import { applyUnifiedLogFilters, unifiedLogsToCsv } from "./logs-query.js";

const rows = [
  {
    id: "1",
    type: "api",
    ts: "2026-09-18T10:00:00.000Z",
    level: "info",
    source: "api",
    method: "GET",
    path: "/health",
    status: 200,
    message: "GET /health → 200",
    email: "ops@lorapok.tech",
  },
  {
    id: "2",
    type: "system",
    ts: "2026-09-18T12:00:00.000Z",
    level: "error",
    source: "deploy",
    message: "Deploy failed",
    meta: { reason: "quota" },
    email: null,
  },
  {
    id: "3",
    type: "mail",
    ts: "2026-09-17T08:00:00.000Z",
    level: "error",
    source: "mailbox",
    status: "failed",
    subject: "Hello",
    message: "outbound notice: Hello",
    email: "user@example.com",
  },
];

assert.equal(applyUnifiedLogFilters(rows, { type: "system" }).length, 1);
assert.equal(applyUnifiedLogFilters(rows, { level: "error" }).length, 2);
assert.equal(applyUnifiedLogFilters(rows, { source: "api" }).length, 1);
assert.equal(applyUnifiedLogFilters(rows, { status: "2xx" }).length, 1);
assert.equal(applyUnifiedLogFilters(rows, { status: "failed" }).length, 1);
assert.equal(applyUnifiedLogFilters(rows, { q: "quota" }).length, 1);
assert.equal(applyUnifiedLogFilters(rows, { since: "2026-09-18T11:00:00.000Z" }).length, 1);
assert.equal(applyUnifiedLogFilters(rows, { until: "2026-09-17T23:59:59.000Z" }).length, 1);
assert.equal(applyUnifiedLogFilters(rows, { email: "ops@" }).length, 1);

const csv = unifiedLogsToCsv(applyUnifiedLogFilters(rows, { type: "system" }));
assert.ok(csv.includes("timestamp,type,level,source"));
assert.ok(csv.includes("Deploy failed"));
assert.ok(csv.includes("quota"));

console.log("logs-query.test.mjs: OK");
