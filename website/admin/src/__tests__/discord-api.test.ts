import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";
import { isValidDiscordWebhookUrl } from "../../functions/api/_shared/discord-config.js";

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

describe("discord integration APIs", () => {
  let server;
  let base;

  beforeEach(async () => {
    resetDevStore();
    const started = await listen(createDevApiMiddleware());
    server = started.server;
    base = started.url;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  it("validates Discord webhook URLs", () => {
    expect(isValidDiscordWebhookUrl("https://discord.com/api/webhooks/123456789/abcdef")).toBe(true);
    expect(isValidDiscordWebhookUrl("https://example.com/hook")).toBe(false);
  });

  it("returns empty discord config by default", async () => {
    const res = await fetch(`${base}/api/integrations/discord/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.configured).toBe(false);
  });

  it("saves a discord webhook URL", async () => {
    const save = await fetch(`${base}/api/integrations/discord/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl: "https://discord.com/api/webhooks/565087/abcdefghijklmnop",
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.configured).toBe(true);
    expect(saved.config.webhookPreview).toContain("565087");
  });
});
