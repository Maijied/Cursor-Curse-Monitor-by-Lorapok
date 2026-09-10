import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";
import { validateImageProvider } from "../../functions/api/_shared/social-ai-config.js";

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

describe("social AI integration APIs", () => {
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

  it("validates paid providers require API keys", () => {
    expect(validateImageProvider({ id: "openai", tier: "paid" }).ok).toBe(false);
    expect(
      validateImageProvider({ id: "openai", tier: "paid", apiKey: "sk-test" }).ok
    ).toBe(true);
  });

  it("returns default svg-fallback config", async () => {
    const res = await fetch(`${base}/api/integrations/social/ai/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.activeProviderId).toBe("svg-fallback");
    expect(data.config.providers.some((entry) => entry.id === "pollinations")).toBe(true);
  });

  it("activates pollinations provider", async () => {
    const save = await fetch(`${base}/api/integrations/social/ai/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "pollinations",
        model: "flux",
        activate: true,
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.activeProviderId).toBe("pollinations");
    expect(saved.config.providers.find((entry) => entry.id === "pollinations")?.active).toBe(true);
  });

  it("saves video carousel settings", async () => {
    const save = await fetch(`${base}/api/integrations/social/ai/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "video",
        enabled: true,
        template: "carousel",
        aspectRatio: "9:16",
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.video.enabled).toBe(true);
    expect(saved.config.video.aspectRatio).toBe("9:16");
  });
});
