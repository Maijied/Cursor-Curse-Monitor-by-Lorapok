import { describe, expect, it } from "vitest";
import { getJobStepState, getPipelineActiveIndex } from "./DeployPipelineSteps";

describe("DeployPipelineSteps helpers", () => {
  it("marks running job as active", () => {
    expect(
      getJobStepState({ id: 1, name: "Build", status: "in_progress", conclusion: null }),
    ).toBe("active");
  });

  it("places larvae on running job", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "B", status: "in_progress", conclusion: null },
      { id: 3, name: "C", status: "queued", conclusion: null },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(1);
  });

  it("advances larvae to next pending after successes", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "B", status: "completed", conclusion: "success" },
      { id: 3, name: "C", status: "queued", conclusion: null },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(2);
  });

  it("rests larvae on last step when all succeed", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "B", status: "completed", conclusion: "success" },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(1);
  });
});
