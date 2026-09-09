import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";
import { validateSocialPlatform } from "../../functions/api/_shared/social-config.js";

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

describe("social integration APIs", () => {
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

  it("validates telegram credentials", () => {
    expect(
      validateSocialPlatform("telegram", {
        enabled: true,
        botToken: "123456789:ABCdefGHIjkl",
        chatId: "-100123",
      }).ok
    ).toBe(true);
  });

  it("returns empty social config by default", async () => {
    const res = await fetch(`${base}/api/integrations/social/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.configured).toBe(false);
    expect(data.config.enabledCount).toBe(0);
  });

  it("saves telegram settings", async () => {
    const save = await fetch(`${base}/api/integrations/social/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "telegram",
        enabled: true,
        botToken: "123456789:ABCdefGHIjkl",
        chatId: "-100999",
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.platforms.telegram.configured).toBe(true);
    expect(saved.config.platforms.telegram.botTokenPreview).toContain("Ijkl");
  });

  it("returns social template previews", async () => {
    const res = await fetch(`${base}/api/integrations/social/preview`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.previews.length).toBe(3);
    expect(data.previews[0].text).toMatch(/Cursor Curse Monitor/);
  });

  it("runs dry-run test matrix", async () => {
    await fetch(`${base}/api/integrations/social/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "telegram",
        enabled: true,
        botToken: "123456789:ABCdefGHIjkl",
        chatId: "-100999",
      }),
    });

    const res = await fetch(`${base}/api/integrations/social/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "community", dryRun: true, platform: "all" }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.dryRun).toBe(true);
    expect(data.summary.sent).toBeGreaterThan(0);
    expect(data.results[0].dryRun).toBe(true);
  });
});
