import { describe, expect, it } from "vitest";
import { parseApiResponse } from "../lib/api";

describe("parseApiResponse", () => {
  it("returns valid JSON for successful responses", () => {
    expect(parseApiResponse<{ ok: boolean }>(JSON.stringify({ ok: true }), true, "/health")).toEqual({ ok: true });
  });

  it("reports invalid JSON with the endpoint", () => {
    expect(() => parseApiResponse("not-json", true, "/health")).toThrow(/API \/health.*invalid JSON/);
  });

  it("prefers API error messages for failed responses", () => {
    expect(() => parseApiResponse(JSON.stringify({ error: "denied" }), false, "/admins")).toThrow("denied");
  });
});
