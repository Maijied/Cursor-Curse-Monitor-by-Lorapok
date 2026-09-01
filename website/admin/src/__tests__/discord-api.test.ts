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
    await resetDevStore();
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
    expect(data.config.deploymentConfigured).toBe(false);
    expect(data.config.configured).toBe(false);
  });

  it("saves a discord webhook URL", async () => {
    const save = await fetch(`${base}/api/integrations/discord/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deploymentWebhookUrl: "https://discord.com/api/webhooks/565087/abcdefghijklmnop",
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.deploymentConfigured).toBe(true);
    expect(saved.config.deploymentWebhookPreview).toContain("565087");
  });

  it("saves a community discord webhook URL", async () => {
    const save = await fetch(`${base}/api/integrations/discord/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        communityWebhookUrl: "https://discord.com/api/webhooks/999888777/communityhooktoken",
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.communityConfigured).toBe(true);
    expect(saved.config.communityWebhookPreview).toContain("999888777");
  });

  it("skips community post when no webhook is saved", async () => {
    const res = await fetch(`${base}/api/integrations/discord/community`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "test" }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.skipped).toBe(true);
  });

  it("skips deployment status when no webhook is saved", async () => {
    const res = await fetch(`${base}/api/integrations/discord/deployment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType: "deployment-status-test", conclusion: "success" }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.skipped).toBe(true);
  });

  it("serves live site-data for dashboard totals", async () => {
    const res = await fetch(`${base}/api/site-data`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.downloads).toBeTruthy();
    expect(typeof data.downloads.verified).toBe("boolean");
    if (data.downloads.verified) {
      expect(typeof data.downloads.total).toBe("number");
      expect(data.downloads.total).toBeGreaterThan(0);
    }
  });
});
