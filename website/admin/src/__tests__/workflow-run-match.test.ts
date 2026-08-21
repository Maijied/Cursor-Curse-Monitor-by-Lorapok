import { describe, expect, it } from "vitest";
import { pickWorkflowRun } from "../lib/workflow-run-match";

describe("workflow-run-match", () => {
  it("matches deployment.yml rollback run instead of latest ci-cd", () => {
    const dispatched = Date.parse("2026-08-18T01:30:00.000Z");
    const runs = [
      { workflow: "ci-cd.yml", createdAt: "2026-08-18T01:35:00.000Z", status: "completed", conclusion: "failure" },
      { workflow: "deployment.yml", createdAt: "2026-08-18T01:31:00.000Z", status: "in_progress", conclusion: null },
    ];
    const match = pickWorkflowRun(runs, { workflowName: "deployment.yml", dispatchedAfter: dispatched });
    expect(match?.workflow).toBe("deployment.yml");
  });
});
