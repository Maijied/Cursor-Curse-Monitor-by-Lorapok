import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";
import {
  buildPublicReindexPolicy,
  normalizeReindexConfig,
} from "../../functions/api/_shared/reindex-config.js";
import { buildPublicSiteConfig } from "../../functions/api/_shared/subscribe-config.js";

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

describe("reindex policy integration APIs", () => {
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

  it("returns default live reindex policy for admin GET", async () => {
    const res = await fetch(`${base}/api/integrations/reindex/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.reindexEnabled).toBe(true);
    expect(data.config.reindexWritePolicy).toBe("live");
  });

  it("saves quit-first reindex policy", async () => {
    const save = await fetch(`${base}/api/integrations/reindex/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reindexWritePolicy: "quit-first" }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.reindexWritePolicy).toBe("quit-first");
  });

  it("rejects invalid reindex write policy", async () => {
    const save = await fetch(`${base}/api/integrations/reindex/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reindexWritePolicy: "unsafe" }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(false);
    expect(saved.error).toMatch(/live or quit-first/i);
  });

  it("exposes reindex policy on public site-config", async () => {
    await fetch(`${base}/api/integrations/reindex/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reindexEnabled: false, reindexWritePolicy: "quit-first" }),
    });
    const res = await fetch(`${base}/api/site-config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.reindexEnabled).toBe(false);
    expect(data.reindexWritePolicy).toBe("quit-first");
    expect(data.requireEditorQuit).toBe(true);
  });

  it("normalizeReindexConfig defaults to live writes", () => {
    const normalized = normalizeReindexConfig({});
    expect(normalized.reindexWritePolicy).toBe("live");
    expect(normalized.reindexEnabled).toBe(true);
  });

  it("buildPublicReindexPolicy maps quit-first to requireEditorQuit", () => {
    const policy = buildPublicReindexPolicy(
      normalizeReindexConfig({ reindexWritePolicy: "quit-first" })
    );
    expect(policy.requireEditorQuit).toBe(true);
  });

  it("buildPublicSiteConfig includes reindex fields", async () => {
    const env = { ADMIN_KV: { get: async () => null, put: async () => {} } };
    const config = await buildPublicSiteConfig(env);
    expect(config.reindexEnabled).toBe(true);
    expect(config.reindexWritePolicy).toBe("live");
    expect(config.requireEditorQuit).toBe(false);
  });
});
