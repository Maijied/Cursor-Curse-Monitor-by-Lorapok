import { describe, expect, it } from "vitest";
import { validatePassword } from "../lib/password-policy";

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    const result = validatePassword("Short1!");
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("At least 12 characters");
  });

  it("accepts strong passwords", () => {
    const result = validatePassword("MissionControl!2026");
    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it("requires complexity", () => {
    const result = validatePassword("missioncontrol2026");
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
