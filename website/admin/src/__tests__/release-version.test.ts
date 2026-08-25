import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  defaultTagSelection,
  effectiveVersionBase,
  formatTagLabel,
  normalizeTag,
} from "../lib/release-version";

describe("release-version", () => {
  it("normalizes tags with v prefix", () => {
    expect(normalizeTag("0.5.10")).toBe("v0.5.10");
    expect(normalizeTag("v0.5.10")).toBe("v0.5.10");
  });

  it("bumps patch/minor/major from live tag", () => {
    expect(bumpVersion("v0.5.9", "patch")).toBe("v0.5.10");
    expect(bumpVersion("v0.5.9", "minor")).toBe("v0.6.0");
    expect(bumpVersion("v0.5.9", "major")).toBe("v1.0.0");
  });

  it("uses custom version when type is custom", () => {
    expect(bumpVersion("v0.5.9", "custom", "0.6.0-beta.1")).toBe("v0.6.0-beta.1");
    expect(bumpVersion("v0.5.9", "custom", "")).toBeNull();
  });

  it("formats live tag label", () => {
    expect(formatTagLabel("v0.5.9", "v0.5.9")).toBe("v0.5.9 (Live)");
    expect(formatTagLabel("v0.5.8", "v0.5.9")).toBe("v0.5.8");
  });

  it("prefers suggested tag for default selection", () => {
    expect(defaultTagSelection(["v0.5.9", "v0.5.10"], "v0.5.9", "v0.5.10")).toBe("v0.5.10");
    expect(defaultTagSelection(["v0.5.8", "v0.5.9"], "v0.5.9", null)).toBe("v0.5.9");
  });

  it("effectiveVersionBase picks higher of live tag vs package.json", () => {
    expect(effectiveVersionBase("v0.5.18", "1.0.3")).toBe("v1.0.3");
    expect(effectiveVersionBase("v1.0.3", "1.0.3")).toBe("v1.0.3");
    expect(effectiveVersionBase(null, "1.0.3")).toBe("v1.0.3");
    expect(bumpVersion(effectiveVersionBase("v0.5.18", "1.0.3"), "patch")).toBe("v1.0.4");
  });
});
