import { describe, expect, it } from "vitest";
import {
  buildWorkflowLogText,
  isReadableLogText,
  isZipArchiveText,
  pickWorkflowRun,
} from "../../functions/api/_shared/workflow-logs.js";

describe("workflow-logs", () => {
  it("detects ZIP archive masquerading as text", () => {
    const zipHeader = String.fromCharCode(0x50, 0x4b, 0x03, 0x04);
    expect(isZipArchiveText(zipHeader + "garbage")).toBe(true);
    expect(isReadableLogText(zipHeader + "garbage")).toBe(false);
  });

  it("builds readable job logs and flags zip/binary fallback", () => {
    const zipHeader = String.fromCharCode(0x50, 0x4b);
    const result = buildWorkflowLogText([
      { name: "Deploy", status: 401, body: "" },
      { name: "Archive", status: 200, body: zipHeader + "\x00\x01binary" },
    ]);
    expect(result.text).toContain("log unavailable: HTTP 401");
    expect(result.text).toContain("log archive returned as ZIP");
    expect(result.logsUnavailable).toBe(true);
    expect(result.logsHint).toBeTruthy();
  });

  it("pickWorkflowRun prefers in-progress ci-cd run after dispatch", () => {
    const dispatched = Date.parse("2026-08-18T01:30:00.000Z");
    const runs = [
      { workflow: "ci-cd.yml", createdAt: "2026-08-18T01:35:00.000Z", status: "completed" },
      { workflow: "ci-cd.yml", createdAt: "2026-08-18T01:31:00.000Z", status: "in_progress" },
    ];
    const match = pickWorkflowRun(runs, { workflowName: "ci-cd.yml", dispatchedAfter: dispatched });
    expect(match?.status).toBe("in_progress");
  });

  it("pickWorkflowRun returns null when no ci-cd match after dispatch", () => {
    const runs = [{ workflow: "seo.yml", createdAt: "2026-08-18T01:35:00.000Z", status: "completed" }];
    expect(pickWorkflowRun(runs, { workflowName: "ci-cd.yml", dispatchedAfter: Date.now() })).toBeNull();
  });
});
