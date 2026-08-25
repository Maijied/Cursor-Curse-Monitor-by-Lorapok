import { describe, expect, it } from "vitest";
import { pickWorkflowRun } from "../lib/workflow-run-match";

describe("workflow-run-match", () => {
  it("matches in-progress ci-cd run over newer unrelated completed run", () => {
    const dispatched = Date.parse("2026-08-18T01:30:00.000Z");
    const runs = [
      { workflow: "ci-cd.yml", createdAt: "2026-08-18T01:35:00.000Z", status: "completed", conclusion: "failure" },
      { workflow: "ci-cd.yml", createdAt: "2026-08-18T01:31:00.000Z", status: "in_progress", conclusion: null },
    ];
    const match = pickWorkflowRun(runs, { workflowName: "ci-cd.yml", dispatchedAfter: dispatched });
    expect(match?.createdAt).toBe("2026-08-18T01:31:00.000Z");
  });
});
