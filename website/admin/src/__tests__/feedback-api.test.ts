import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";

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

describe("feedback API", () => {
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

  it("accepts probe requests", async () => {
    const res = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.probed).toBe(true);
  });

  it("requires a message", async () => {
    const res = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "bug", message: "   " }),
    });
    expect(res.status).toBe(400);
  });

  it("stores feedback when Discord webhook is not configured", async () => {
    const res = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "feature",
        message: "Please add dark mode to the popup chart legend.",
        source: "vitest",
        version: "1.0.0-test",
      }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.ok).toBe(true);
    expect(data.stored).toBe(true);
    expect(data.discordDelivered).toBe(false);
  });

  it("stores feedback when a Discord webhook is configured but unreachable", async () => {
    const save = await fetch(`${base}/api/integrations/discord/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedbackWebhookUrl: "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789",
      }),
    });
    expect(save.ok).toBe(true);

    const res = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "bug",
        message: "Gauge shows 0% after account switch in Firefox.",
        source: "vitest-discord",
      }),
    });
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.stored).toBe(true);
    expect(data.discordDelivered).toBe(false);
  });
});
