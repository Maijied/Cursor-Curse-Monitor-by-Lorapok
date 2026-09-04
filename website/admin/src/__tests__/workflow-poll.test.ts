import { describe, expect, it } from "vitest";
import { pickWorkflowRun } from "../lib/workflow-run-match";

describe("useWorkflowPoll mail sync matching", () => {
  it("picks deploy-infra run after dispatch time", () => {
    const dispatchedAfter = Date.parse("2026-09-04T18:00:00.000Z");
    const runs = [
      {
        id: 1,
        name: "Production Deployment",
        workflow: "ci-cd.yml",
        status: "in_progress",
        conclusion: null,
        url: "https://github.com/example/run/1",
        branch: "main",
        event: "workflow_dispatch",
        createdAt: "2026-09-04T18:00:05.000Z",
        updatedAt: "2026-09-04T18:00:10.000Z",
      },
      {
        id: 2,
        name: "Old run",
        workflow: "ci-cd.yml",
        status: "completed",
        conclusion: "success",
        url: "https://github.com/example/run/2",
        branch: "main",
        event: "push",
        createdAt: "2026-09-03T12:00:00.000Z",
        updatedAt: "2026-09-03T12:05:00.000Z",
      },
    ];

    const match = pickWorkflowRun(runs, { workflowName: "ci-cd.yml", dispatchedAfter });
    expect(match?.id).toBe(1);
  });
});
