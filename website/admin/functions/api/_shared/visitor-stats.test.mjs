import assert from "node:assert/strict";
import test from "node:test";
import { pickFresherSource, mergePackageClicks, DEFAULT_STATS } from "./visitor-stats.js";

test("mergePackageClicks takes per-channel max", () => {
  const merged = mergePackageClicks(
    { ovsx: 3, vscode: 1, github: 0, vsix: 0, npm: 0, openvsxDuplicate: 0 },
    { ovsx: 1, vscode: 4, github: 2, vsix: 0, npm: 0, openvsxDuplicate: 0 },
  );
  assert.equal(merged.ovsx, 3);
  assert.equal(merged.vscode, 4);
  assert.equal(merged.github, 2);
});

test("pickFresherSource prefers newer updatedAt", () => {
  const kv = {
    websiteVisits: 278,
    updatedAt: "2026-10-19T12:00:00.000Z",
  };
  const firestore = {
    websiteVisits: 280,
    updatedAt: "2026-09-20T10:00:00.000Z",
  };
  assert.equal(pickFresherSource(kv, firestore), "kv");
});

test("pickFresherSource falls back to higher visits when timestamps missing", () => {
  const kv = { websiteVisits: 100, updatedAt: null };
  const firestore = { websiteVisits: 200, updatedAt: null };
  assert.equal(pickFresherSource(kv, firestore), "firestore");
});

test("DEFAULT_STATS packageClicks shape is stable", () => {
  assert.ok(DEFAULT_STATS.packageClicks.ovsx === 0);
});
