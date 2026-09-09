import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEO_PROVIDERS,
  mergeSeoHubUpdate,
  mergeSeoProviderUpdate,
  sanitizeSeoConfigForClient,
  validateSeoProvider,
} from "./seo-config.js";

describe("seo-config", () => {
  it("validates google search console site URL when enabled", () => {
    assert.equal(
      validateSeoProvider("googleSearchConsole", {
        enabled: true,
        siteUrl: "https://cursor.lorapok.tech",
      }).ok,
      true
    );
    assert.equal(
      validateSeoProvider("googleSearchConsole", { enabled: true, siteUrl: "http://bad" }).ok,
      false
    );
  });

  it("merges provider updates without wiping secrets", () => {
    const current = {
      bingWebmaster: { enabled: true, siteUrl: "https://cursor.lorapok.tech", apiKey: "secret-key" },
      hub: { sitemapUrl: "", robotsNotes: "" },
      updatedAt: null,
      updatedBy: null,
    };
    const next = mergeSeoProviderUpdate(current, "bingWebmaster", {
      siteUrl: "https://cursor.lorapok.tech/",
    });
    assert.equal(next.bingWebmaster.siteUrl, "https://cursor.lorapok.tech");
    assert.equal(next.bingWebmaster.apiKey, "secret-key");
  });

  it("sanitizes secrets for client responses", () => {
    const sanitized = sanitizeSeoConfigForClient({
      googleSearchConsole: { enabled: false, siteUrl: "", serviceAccountJson: "" },
      bingWebmaster: { enabled: true, siteUrl: "https://cursor.lorapok.tech", apiKey: "abcdefghijklmnop" },
      azureWebmaster: { enabled: false, siteUrl: "", apiKey: "" },
      cloudflareAnalytics: { enabled: false, zoneId: "", apiToken: "", siteUrl: "" },
      pageSpeedInsights: { enabled: false, apiKey: "", siteUrl: "" },
      hub: { sitemapUrl: "https://cursor.lorapok.tech/sitemap.xml", robotsNotes: "Allow marketing" },
      updatedAt: "2026-01-01T00:00:00.000Z",
      updatedBy: "ops@lorapok.tech",
    });
    assert.equal(sanitized.providers.bingWebmaster.apiKeyPreview, "···mnop");
    assert.equal(sanitized.enabledCount, 1);
    assert.equal(SEO_PROVIDERS.length, 5);
    assert.equal(sanitized.hub.sitemapUrl, "https://cursor.lorapok.tech/sitemap.xml");
  });

  it("merges hub sitemap URL", () => {
    const next = mergeSeoHubUpdate(
      { hub: { sitemapUrl: "", robotsNotes: "" }, updatedAt: null, updatedBy: null },
      { sitemapUrl: "https://cursor.lorapok.tech/sitemap.xml" }
    );
    assert.equal(next.hub.sitemapUrl, "https://cursor.lorapok.tech/sitemap.xml");
  });
});
