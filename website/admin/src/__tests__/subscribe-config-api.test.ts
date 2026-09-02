import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";
import {
  buildPublicSiteConfig,
  isValidDiscordInviteUrl,
  normalizeSubscribeConfig,
} from "../../functions/api/_shared/subscribe-config.js";

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

describe("subscribe prompt integration APIs", () => {
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

  it("validates Discord invite URLs", () => {
    expect(isValidDiscordInviteUrl("https://discord.gg/MaYRtaqef")).toBe(true);
    expect(isValidDiscordInviteUrl("https://discord.com/invite/bp42QAMC6")).toBe(true);
    expect(isValidDiscordInviteUrl("https://example.com/invite")).toBe(false);
  });

  it("returns default subscribe config for admin GET", async () => {
    const res = await fetch(`${base}/api/integrations/subscribe/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.subscribeModalEnabled).toBe(true);
    expect(data.config.requireMailForSubscribe).toBe(true);
    expect(data.config.subscribeFallbackMode).toBe("discord");
    expect(data.config.subscribeFallbackDiscordUrl).toContain("discord.gg/");
  });

  it("saves subscribe fallback settings", async () => {
    const save = await fetch(`${base}/api/integrations/subscribe/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscribeFallbackDiscordUrl: "https://discord.gg/MaYRtaqef",
        subscribeFallbackMode: "hidden",
        requireMailForSubscribe: false,
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.subscribeFallbackMode).toBe("hidden");
    expect(saved.config.requireMailForSubscribe).toBe(false);
  });

  it("rejects invalid Discord invite URLs on save", async () => {
    const save = await fetch(`${base}/api/integrations/subscribe/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscribeFallbackDiscordUrl: "https://example.com/not-discord" }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(false);
    expect(saved.error).toMatch(/Invalid Discord invite/i);
  });

  it("serves public site-config without secrets", async () => {
    const res = await fetch(`${base}/api/site-config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(typeof data.mailConfigured).toBe("boolean");
    expect(data.discordInviteUrl).toBe("https://discord.gg/bp42QAMC6");
    expect(typeof data.subscribeAvailable).toBe("boolean");
    expect(data).not.toHaveProperty("RESEND_API_KEY");
    expect(data).not.toHaveProperty("webhookUrl");
  });

  it("buildPublicSiteConfig exposes Discord fallback when mail required but unavailable", async () => {
    const env = { ADMIN_KV: { get: async () => null, put: async () => {} } };
    const config = await buildPublicSiteConfig(env);
    expect(config.requireMailForSubscribe).toBe(true);
    if (!config.mailConfigured) {
      expect(config.subscribeAvailable).toBe(false);
      expect(config.subscribeFallbackMode).toBe("discord");
      expect(config.subscribeFallbackDiscordUrl).toContain("discord.gg/");
    }
  });

  it("normalizeSubscribeConfig falls back to default invite when invalid", () => {
    const normalized = normalizeSubscribeConfig({
      subscribeFallbackDiscordUrl: "not-a-url",
    });
    expect(normalized.subscribeFallbackDiscordUrl).toBe("https://discord.gg/bp42QAMC6");
  });
});
