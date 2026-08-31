#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSiteData } from "./site-data.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(fixtureDir, "fixtures/site-data.fixture.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

const originalFetch = globalThis.fetch;

globalThis.fetch = async (url) => {
  if (String(url).includes("cursor.lorapok.tech")) {
    return new Response("forbidden", { status: 403 });
  }
  return originalFetch(url);
};

try {
  const fromFile = await fetchSiteData({ SITE_DATA_FILE: fixturePath });
  assert.equal(fromFile.packageVersion, fixture.packageVersion);

  process.env.CI = "true";
  process.env.SITE_DATA_FILE = fixturePath;
  const fromCiPrefer = await fetchSiteData({});
  assert.equal(fromCiPrefer.packageVersion, fixture.packageVersion);

  delete process.env.SITE_DATA_FILE;
  delete process.env.CI;

  const withDefaultFallback = await fetchSiteData({
    SITE_DATA_URL: "https://cursor.lorapok.tech/site-data.json",
  });
  assert.ok(
    withDefaultFallback.packageVersion || withDefaultFallback.version,
    "falls back to committed website/site-data.json when remote is blocked"
  );

  const fallback = await fetchSiteData({
    SITE_DATA_URL: "https://cursor.lorapok.tech/site-data.json",
    SITE_DATA_FILE: fixturePath,
  });
  assert.equal(fallback.packageVersion, fixture.packageVersion);

  console.log("site-data.test.mjs: OK");
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.CI;
  delete process.env.SITE_DATA_FILE;
}
