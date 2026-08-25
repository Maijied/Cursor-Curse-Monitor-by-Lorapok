import { describe, expect, it } from "vitest";
import { buildDonutStrokeSlices } from "./MarketplaceDistributionChart";

describe("buildDonutStrokeSlices", () => {
  const circumference = 100;

  it("stacks segments without overlap", () => {
    const channels = [
      { id: "a", count: 3451 },
      { id: "b", count: 0 },
      { id: "c", count: 3 },
    ];
    const slices = buildDonutStrokeSlices(channels, 3454, circumference);
    expect(slices).toHaveLength(2);
    expect(slices[0].id).toBe("a");
    expect(slices[0].dashOffset).toBeCloseTo(0, 5);
    expect(slices[0].length).toBeCloseTo(99.913, 1);
    expect(slices[1].id).toBe("c");
    expect(slices[1].dashOffset).toBeCloseTo(-slices[0].length, 5);
    expect(slices[0].length + slices[1].length).toBeCloseTo(circumference, 5);
  });

  it("covers full ring for a single channel", () => {
    const slices = buildDonutStrokeSlices([{ id: "only", count: 99 }], 99, circumference);
    expect(slices).toHaveLength(1);
    expect(slices[0].length).toBe(circumference);
    expect(slices[0].dashOffset).toBeCloseTo(0, 5);
  });
});
