import { describe, expect, it } from "vitest";
import { probeAdminD1 } from "../../functions/api/_shared/d1-admin.js";

describe("probeAdminD1", () => {
  it("reports missing binding", async () => {
    const result = await probeAdminD1({});
    expect(result.configured).toBe(false);
    expect(result.ok).toBe(false);
  });

  it("probes bound database", async () => {
    const result = await probeAdminD1({
      ADMIN_D1: {
        prepare: () => ({
          first: async () => ({ ok: 1 }),
        }),
      },
    });
    expect(result).toEqual({ configured: true, ok: true });
  });

  it("surfaces query errors", async () => {
    const result = await probeAdminD1({
      ADMIN_D1: {
        prepare: () => ({
          first: async () => {
            throw new Error("D1 unavailable");
          },
        }),
      },
    });
    expect(result.configured).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("D1 unavailable");
  });
});
