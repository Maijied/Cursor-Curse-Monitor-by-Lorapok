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

describe("mail config API", () => {
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

  it("returns default mail identities", async () => {
    const res = await fetch(`${base}/api/integrations/mail/config`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.config.productEmail).toBe("cursor.monitor@lorapok.tech");
    expect(data.config.supportEmail).toBe("cursor.curse.help@lorapok.tech");
    expect(data.config.resendFirstExternal).toBe(true);
  });

  it("saves mail identity overrides", async () => {
    const save = await fetch(`${base}/api/integrations/mail/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productEmail: "product@lorapok.tech",
        resendFirstExternal: false,
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.productEmail).toBe("product@lorapok.tech");
    expect(saved.config.resendFirstExternal).toBe(false);
  });
});
