import assert from "node:assert/strict";
import { buildServiceAnalyticsHub, deriveServiceStatus } from "./service-analytics.js";

assert.equal(deriveServiceStatus(true, true), "ok");
assert.equal(deriveServiceStatus(false, true), "danger");
assert.equal(deriveServiceStatus(null, false), "warn");

const hub = buildServiceAnalyticsHub({
  generatedAt: "2026-09-18T00:00:00.000Z",
  adminKvConfigured: true,
  statsR2: { configured: true, ok: true },
  adminD1Configured: true,
  adminD1Ok: true,
  firebaseConfigured: true,
  firebaseProject: "demo",
  githubOk: true,
  githubTokenConfigured: true,
  githubOpenIssues: 12,
  githubStars: 40,
  mailConfigured: true,
  mailTransport: "resend",
  mailResendConfigured: true,
  displayTotal: 15000,
  syncStatus: "synced",
  packageVersion: "1.0.0",
  websiteVisits: 900,
  totalEngagement: 1200,
  visitorSource: "kv",
});

assert.equal(hub.generatedAt, "2026-09-18T00:00:00.000Z");
assert.equal(hub.overall, "online");
assert.ok(hub.cards.length >= 8);
assert.ok(hub.cards.some((c) => c.id === "marketplace" && c.metrics[0].value === 15000));
assert.ok(hub.cards.some((c) => c.id === "github" && c.status === "ok"));

const offline = buildServiceAnalyticsHub({
  adminKvConfigured: false,
  githubOk: false,
});
assert.equal(offline.overall, "offline");

console.log("service-analytics.test.mjs: OK");
