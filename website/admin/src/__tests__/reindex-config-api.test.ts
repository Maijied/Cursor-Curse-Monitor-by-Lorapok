import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware, resetDevStore } from "../../vite-dev-api.mjs";
import {
  buildPublicCursorIndexPolicy,
  normalizeCursorIndexConfig,
} from "../../functions/api/_shared/cursor-index-config.js";
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

describe("cursor index policy integration APIs", () => {
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

  it("returns default live cursor index policy for admin GET", async () => {
    const res = await fetch(`${base}/api/integrations/cursor-index/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.indexEnabled).toBe(true);
    expect(data.config.indexWritePolicy).toBe("live");
    expect(data.config.transcriptLookbackDays).toBe(0);
  });

  it("saves lookback days and record limits", async () => {
    const save = await fetch(`${base}/api/integrations/cursor-index/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcriptLookbackDays: 14,
        maxReindexRecords: 250,
        maxExportRecords: 100,
        maxImportRecords: 50,
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.transcriptLookbackDays).toBe(14);
    expect(saved.config.maxReindexRecords).toBe(250);
  });

  it("saves quit-first write policy", async () => {
    const save = await fetch(`${base}/api/integrations/cursor-index/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indexWritePolicy: "quit-first" }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.indexWritePolicy).toBe("quit-first");
  });

  it("rejects invalid write policy", async () => {
    const save = await fetch(`${base}/api/integrations/cursor-index/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indexWritePolicy: "unsafe" }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(false);
    expect(saved.error).toMatch(/live or quit-first/i);
  });

  it("exposes cursor index policy on public site-config", async () => {
    await fetch(`${base}/api/integrations/cursor-index/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        indexEnabled: false,
        indexWritePolicy: "quit-first",
        transcriptLookbackDays: 30,
      }),
    });
    const res = await fetch(`${base}/api/site-config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.indexEnabled).toBe(false);
    expect(data.indexWritePolicy).toBe("quit-first");
    expect(data.requireEditorQuit).toBe(true);
    expect(data.transcriptLookbackDays).toBe(30);
  });

  it("legacy reindex route remains compatible", async () => {
    const res = await fetch(`${base}/api/integrations/reindex/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.reindexEnabled).toBe(true);
    expect(data.config.reindexWritePolicy).toBe("live");
  });

  it("normalizeCursorIndexConfig defaults to live writes and all-time lookback", () => {
    const normalized = normalizeCursorIndexConfig({});
    expect(normalized.indexWritePolicy).toBe("live");
    expect(normalized.indexEnabled).toBe(true);
    expect(normalized.transcriptLookbackDays).toBe(0);
  });

  it("buildPublicCursorIndexPolicy maps quit-first to requireEditorQuit", () => {
    const policy = buildPublicCursorIndexPolicy(
      normalizeCursorIndexConfig({ indexWritePolicy: "quit-first" })
    );
    expect(policy.requireEditorQuit).toBe(true);
  });

  it("buildPublicSiteConfig includes cursor index fields", async () => {
    const env = { ADMIN_KV: { get: async () => null, put: async () => {} } };
    const config = await buildPublicSiteConfig(env);
    expect(config.indexEnabled).toBe(true);
    expect(config.indexWritePolicy).toBe("live");
    expect(config.requireEditorQuit).toBe(false);
    expect(config.transcriptLookbackDays).toBe(0);
  });

  it("normalizeReindexConfig remains a thin alias", () => {
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
});
