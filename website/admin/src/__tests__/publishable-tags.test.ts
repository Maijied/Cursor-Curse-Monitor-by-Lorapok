import { describe, expect, it } from "vitest";
import {
  compareTags,
  enrichTags,
  filterPublishableTags,
} from "../../functions/api/_shared/publishable-tags.js";

describe("publishable-tags", () => {
  it("filters tags below v0.5.5 and CI-only tags", () => {
    expect(filterPublishableTags(["v0.5.4", "v0.5.5", "v0.5.9", "v1.0.34-dev.5"])).toEqual([
      "v0.5.5",
      "v0.5.9",
    ]);
  });

  it("does not block arbitrary tags", () => {
    expect(filterPublishableTags(["v0.5.10", "v0.5.9"])).toEqual(["v0.5.10", "v0.5.9"]);
  });

  it("compareTags orders semver correctly", () => {
    expect(compareTags("v0.5.9", "v0.5.10")).toBeLessThan(0);
    expect(compareTags("v1.0.0", "v0.5.9")).toBeGreaterThan(0);
  });

  it("enrichTags marks live and suggested tags", () => {
    const result = enrichTags(["v0.5.8", "v0.5.9", "v0.5.10"], "v0.5.9");
    expect(result.liveTag).toBe("v0.5.9");
    expect(result.latestTag).toBe("v0.5.10");
    expect(result.suggestedTag).toBe("v0.5.10");
    expect(result.tags[0]).toBe("v0.5.10");
  });

  it("enrichTags returns null suggested when nothing is newer than live", () => {
    const result = enrichTags(["v0.5.8", "v0.5.9"], "v0.5.9");
    expect(result.suggestedTag).toBeNull();
    expect(result.latestTag).toBe("v0.5.9");
  });
});
