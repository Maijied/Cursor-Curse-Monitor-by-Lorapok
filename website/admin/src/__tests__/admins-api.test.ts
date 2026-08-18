import { describe, it, expect } from "vitest";
import { startTestDataServer } from "../test-support/test-server";

describe("admins API (dev KV mirror)", () => {
  it("lists stored admin emails without hardcoded fixtures", async () => {
    const server = await startTestDataServer();
    try {
      const res = await fetch(`${server.apiBase}/admins`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { emails: string[]; source: string };
      expect(body.source).toBe("local-file");
      expect(Array.isArray(body.emails)).toBe(true);
    } finally {
      await server.close();
    }
  });
});
