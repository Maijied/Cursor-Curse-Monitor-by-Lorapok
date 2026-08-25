import { describe, expect, it } from "vitest";
import {
  extractMarketplaceTargets,
  getJobStepState,
  getPipelineActiveIndex,
  sortWorkflowJobs,
} from "./workflow-jobs";

describe("workflow-jobs", () => {
  it("sorts jobs into workflow order", () => {
    const sorted = sortWorkflowJobs([
      { name: "Deploy to Marketplaces" },
      { name: "Build & Validate (Root Extension)" },
      { name: "Admin Panel CI" },
    ]);
    expect(sorted.map((job) => job.name)).toEqual([
      "Build & Validate (Root Extension)",
      "Admin Panel CI",
      "Deploy to Marketplaces",
    ]);
  });

  it("marks skipped jobs separately from queued", () => {
    expect(
      getJobStepState({ status: "completed", conclusion: "skipped" }),
    ).toBe("skipped");
  });

  it("ignores skipped jobs when finding active pipeline step", () => {
    const jobs = [
      { id: 1, name: "A", status: "completed", conclusion: "success" },
      { id: 2, name: "B", status: "completed", conclusion: "skipped" },
      { id: 3, name: "C", status: "in_progress", conclusion: null },
    ];
    expect(getPipelineActiveIndex(jobs)).toBe(2);
  });

  it("extracts marketplace targets from deploy job steps", () => {
    const targets = extractMarketplaceTargets({
      id: 1,
      name: "Deploy to Marketplaces",
      status: "in_progress",
      conclusion: null,
      steps: [
        { name: "Publish to VS Code Marketplace", status: "completed", conclusion: "success", number: 1 },
        { name: "Publish to Open VSX (canonical lorapok-labs)", status: "in_progress", conclusion: null, number: 2 },
        { name: "Publish to Open VSX (LorapokLabs duplicate — keep for existing installs)", status: "pending", conclusion: null, number: 3 },
        { name: "Publish to Firefox Add-ons (AMO)", status: "pending", conclusion: null, number: 4 },
        { name: "Create GitHub Release", status: "pending", conclusion: null, number: 5 },
      ],
    });

    expect(targets).toHaveLength(5);
    expect(targets[0]?.state).toBe("success");
    expect(targets[1]?.state).toBe("active");
    expect(targets[3]?.label).toBe("Firefox AMO");
  });

  it("hides skipped marketplace targets for single-market deploys", () => {
    const targets = extractMarketplaceTargets({
      id: 1,
      name: "Deploy to Marketplaces",
      status: "completed",
      conclusion: "success",
      steps: [
        { name: "Publish to Firefox Add-ons (AMO)", status: "completed", conclusion: "success", number: 1 },
        { name: "Publish to VS Code Marketplace", status: "completed", conclusion: "skipped", number: 2 },
      ],
    });

    expect(targets.map((t) => t.id)).toEqual(["amo"]);
  });
});
