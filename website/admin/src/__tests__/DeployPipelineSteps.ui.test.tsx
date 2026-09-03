import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import DeployPipelineSteps from "../components/ui/DeployPipelineSteps";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
});

describe("DeployPipelineSteps UI", () => {
  it("shows larvae on the in-progress job when an earlier job is still queued", () => {
    const jobs = [
      { id: 1, name: "Build & Validate (Root Extension)", status: "completed", conclusion: "success" },
      { id: 2, name: "Admin Panel CI", status: "queued", conclusion: null },
      { id: 3, name: "Deploy to Marketplaces", status: "in_progress", conclusion: null },
      { id: 4, name: "Deploy Admin Panel", status: "queued", conclusion: null },
    ];

    render(<DeployPipelineSteps jobs={jobs} />);

    expect(screen.getByLabelText("Pipeline progress")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    expect(screen.getAllByText("running")).toHaveLength(1);
    expect(screen.getByText("Marketplaces")).toBeInTheDocument();
  });
});
