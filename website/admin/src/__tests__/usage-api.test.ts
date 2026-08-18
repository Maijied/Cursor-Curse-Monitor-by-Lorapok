import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { createDevApiMiddleware } from "../../vite-dev-api.mjs";

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
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

describe("usage + community APIs", () => {
  let server;
  let base;

  beforeEach(async () => {
    const started = await listen(createDevApiMiddleware());
    server = started.server;
    base = started.url;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  it("rejects bad usage ping", async () => {
    const res = await fetch(`${base}/api/usage/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installId: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts and dedupes usage ping", async () => {
    const installId = "11111111-1111-4111-8111-111111111111";
    const body = JSON.stringify({ installId, os: "linux", host: "cursor", version: "0.5.8" });
    const a = await fetch(`${base}/api/usage/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const b = await fetch(`${base}/api/usage/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const stats = await (await fetch(`${base}/api/usage/stats`)).json();
    expect(stats.optInUniques.uniqueAll).toBe(1);
    expect(JSON.stringify(stats)).not.toContain(installId);
  });

  it("serves community config without secrets", async () => {
    const res = await fetch(`${base}/api/community/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data).toHaveProperty("defaultCategorySlug");
    expect(JSON.stringify(data).toLowerCase()).not.toContain("token");
  });
});
