#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getNoticeTemplates } from "./notice-catalog.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(fixtureDir, "fixtures/site-data.fixture.json"), "utf8");
const fixtureUrl = "http://fixture.local/site-data.json";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === fixtureUrl) {
    return new Response(fixture, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return originalFetch(url, init);
};

try {
  const templates = await getNoticeTemplates({ SITE_DATA_URL: fixtureUrl });
  const feature = templates.find((t) => t.templateId === "feature-release");
  assert.ok(feature, "feature-release template exists");
  assert.ok(
    !feature.label.includes("{{"),
    `expected hydrated label, got: ${feature.label}`
  );
  assert.match(feature.label, /v9\.9\.9/);
  console.log("notice-hydration.test.mjs: OK", feature.label);
} finally {
  globalThis.fetch = originalFetch;
}
