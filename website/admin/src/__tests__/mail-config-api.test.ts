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
    expect(data.config.workersFreeMode).toBe(true);
    expect(data.config.sendingDomain).toBe("lorapok.tech");
    expect(data.setupInstructions.steps.length).toBeGreaterThan(0);
  });

  it("saves mail identity and Resend settings", async () => {
    const save = await fetch(`${base}/api/integrations/mail/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productEmail: "product@lorapok.tech",
        resendFirstExternal: false,
        workersFreeMode: true,
        sendingDomain: "mail.lorapok.tech",
        resendFromOverride: "Test <test@mail.lorapok.tech>",
        resendDomainVerified: true,
      }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(true);
    expect(saved.config.productEmail).toBe("product@lorapok.tech");
    expect(saved.config.resendFirstExternal).toBe(false);
    expect(saved.config.sendingDomain).toBe("mail.lorapok.tech");
    expect(saved.config.resendDomainVerified).toBe(true);
  });

  it("rejects non-object JSON bodies", async () => {
    const save = await fetch(`${base}/api/integrations/mail/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    const saved = await save.json();
    expect(save.ok).toBe(false);
    expect(saved.error).toMatch(/JSON object/i);
  });

  it("rejects non-boolean resendFirstExternal values", async () => {
    const save = await fetch(`${base}/api/integrations/mail/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resendFirstExternal: "false" }),
    });
    const saved = await save.json();
    expect(save.ok).toBe(false);
    expect(saved.error).toMatch(/boolean/i);
  });

  it("returns mail setup status aggregate", async () => {
    const res = await fetch(`${base}/api/integrations/mail/status`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.transport).toBeDefined();
    expect(data.identities.productEmail).toBe("cursor.monitor@lorapok.tech");
    expect(data.identities.sendingDomain).toBe("lorapok.tech");
    expect(data.setupInstructions).toBeDefined();
    expect(Array.isArray(data.setupInstructions.steps)).toBe(true);
    expect(Array.isArray(data.recommendations)).toBe(true);
    expect(typeof data.subscribeAvailable).toBe("boolean");
  });
});
