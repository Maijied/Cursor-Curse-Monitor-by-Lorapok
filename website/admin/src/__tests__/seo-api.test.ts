import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";
import { validateSeoProvider } from "../../functions/api/_shared/seo-config.js";

function listen(handler) {
  const server = createServer((req, res) => {
    handler(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe("seo integration APIs", () => {
  let server;
  let base;

  beforeEach(async () => {
    await resetDevStore();
    const started = await listen(createDevApiMiddleware());
    server = started.server;
    base = started.url;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  it("validates bing webmaster credentials", () => {
    expect(
      validateSeoProvider("bingWebmaster", {
        enabled: true,
        siteUrl: "https://cursor.lorapok.tech",
        apiKey: "bing-key",
      }).ok
    ).toBe(true);
  });

  it("returns empty seo config by default", async () => {
    const res = await fetch(`${base}/api/integrations/seo/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.configured).toBe(false);
    expect(data.config.enabledCount).toBe(0);
  });

  it("saves pageSpeed settings", async () => {
    const save = await fetch(`${base}/api/integrations/seo/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "pageSpeedInsights",
        enabled: true,
        siteUrl: "https://cursor.lorapok.tech",
        apiKey: "pagespeed-secret-key",
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.providers.pageSpeedInsights.configured).toBe(true);
    expect(saved.config.providers.pageSpeedInsights.apiKeyPreview).toBe("···-key");
  });

  it("saves hub sitemap override", async () => {
    const save = await fetch(`${base}/api/integrations/seo/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "hub",
        sitemapUrl: "https://cursor.lorapok.tech/sitemap.xml",
        robotsNotes: "Allow marketing root",
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.hub.sitemapUrl).toBe("https://cursor.lorapok.tech/sitemap.xml");
  });
});
