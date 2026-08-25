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
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

describe("notice catalog APIs", () => {
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

  it("seeds the generated marketing notice into the catalog", async () => {
    const res = await fetch(`${base}/api/notices`);
    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.items.some((n) => n.id === "generated-dev-notice")).toBe(true);
    expect(data.items.some((n) => n.id === "conversation-recovery-v0515")).toBe(true);
    expect(data.active?.id).toBe("generated-dev-notice");
    expect(data.active?.enabled).toBe(true);
  });

  it("returns the enabled catalog item from public GET /api/notice", async () => {
    const res = await fetch(`${base}/api/notice`);
    const notice = await res.json();
    expect(res.ok).toBe(true);
    expect(notice.enabled).toBe(true);
    expect(notice.title).toBe("Active Development Notice");
  });

  it("hides the public banner when the generated notice is disabled", async () => {
    const disable = await fetch(`${base}/api/notices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "generated-dev-notice", enabled: false }),
    });
    expect(disable.ok).toBe(true);

    const live = await (await fetch(`${base}/api/notice`)).json();
    expect(live.enabled).toBe(false);

    const catalog = await (await fetch(`${base}/api/notices`)).json();
    const generated = catalog.items.find((n) => n.id === "generated-dev-notice");
    expect(generated?.enabled).toBe(false);
    expect(catalog.active).toBeNull();
  });

  it("creates, enables, and deletes admin notices", async () => {
    const created = await fetch(`${base}/api/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Release window",
        shortMessage: "Stable build ships tonight.",
        message: "Full release notes follow.",
        severity: "info",
        enabled: true,
      }),
    });
    const createdBody = await created.json();
    expect(created.ok).toBe(true);
    expect(createdBody.notice.title).toBe("Release window");
    expect(createdBody.notice.enabled).toBe(true);
    expect(createdBody.items.filter((n) => n.enabled)).toHaveLength(1);

    const live = await (await fetch(`${base}/api/notice`)).json();
    expect(live.title).toBe("Release window");

    const deleted = await fetch(`${base}/api/notices?id=${encodeURIComponent(createdBody.notice.id)}`, {
      method: "DELETE",
    });
    expect(deleted.ok).toBe(true);
    const after = await deleted.json();
    expect(after.items.some((n) => n.id === createdBody.notice.id)).toBe(false);
  });
});

describe("website live-notice fallback", () => {
  it("does not use site-data when the live API is reachable and disabled", () => {
    const siteDataNotice = { enabled: true, title: "Active Development Notice" };
    const live = { reachable: true, notice: null };
    const notice = live.reachable ? live.notice : siteDataNotice;
    expect(notice).toBeNull();
  });

  it("falls back to site-data only when the live API is unreachable", () => {
    const siteDataNotice = { enabled: true, title: "Active Development Notice" };
    const live = { reachable: false, notice: null };
    const notice = live.reachable ? live.notice : siteDataNotice;
    expect(notice?.title).toBe("Active Development Notice");
  });
});
