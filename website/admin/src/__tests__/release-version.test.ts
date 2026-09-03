import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  defaultDeployTag,
  defaultRollbackSourceTag,
  defaultTagSelection,
  effectiveVersionBase,
  filterTagsForChannel,
  formatTagLabel,
  isBetaPrereleaseTag,
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

  it("filterTagsForChannel hides CI-only tags and semver pre-release suffixes", () => {
    const tags = ["v1.0.30", "v1.0.31-beta.1", "v1.0.32", "v1.0.34-dev.5"];
    expect(filterTagsForChannel(tags, "production", "deploy")).toEqual(["v1.0.30", "v1.0.32"]);
    expect(filterTagsForChannel(tags, "beta", "deploy")).toEqual(["v1.0.30", "v1.0.32"]);
    expect(filterTagsForChannel(tags, "production", "rollback")).toEqual(["v1.0.30", "v1.0.32"]);
  });

  it("detects beta and rollback tag labels", () => {
    expect(isBetaPrereleaseTag("v1.0.31-beta.1")).toBe(true);
    expect(formatTagLabel("v1.0.31-beta.1", null)).toContain("Pre-release");
    expect(formatTagLabel("v1.0.R2", null)).toContain("Rollback");
  });
});
