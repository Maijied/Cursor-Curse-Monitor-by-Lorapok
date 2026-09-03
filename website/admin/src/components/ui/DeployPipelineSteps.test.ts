import { describe, expect, it } from "vitest";
import { getJobStepState, getPipelineActiveIndex } from "./DeployPipelineSteps";

describe("DeployPipelineSteps helpers", () => {
  it("marks running job as active", () => {
    expect(
      getJobStepState({ id: 1, name: "Build", status: "in_progress", conclusion: null }),
    ).toBe("active");
  });

  it("tracks the in-progress job as the active pipeline index", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "B", status: "in_progress", conclusion: null },
      { id: 3, name: "C", status: "queued", conclusion: null },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(1);
  });

  it("advances the active index to the next pending job after successes", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "B", status: "completed", conclusion: "success" },
      { id: 3, name: "C", status: "queued", conclusion: null },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(2);
  });

  it("skips over completed skipped jobs", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "SEO", status: "completed", conclusion: "skipped" },
      { id: 3, name: "C", status: "in_progress", conclusion: null },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(2);
  });

  it("rests on the last step when all jobs succeed", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "B", status: "completed", conclusion: "success" },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(1);
  });
});
