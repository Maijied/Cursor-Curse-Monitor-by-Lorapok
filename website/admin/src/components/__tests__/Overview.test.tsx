import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Overview from "../pages/Overview";

vi.mock("../../hooks/useSiteData", () => ({
  useSiteData: () => ({
    loading: false,
    error: null,
    data: {
      generatedAt: "2026-09-08T14:00:00.000Z",
      version: "1.0.79",
      packageVersion: "1.0.79",
      syncStatus: "synced",
      downloads: {
        total: 1200,
        breakdown: {},
        openVsxCombined: 500,
      },
      github: { releaseTag: "v1.0.79" },
      ovsx: { version: "1.0.79" },
      vscode: { version: "1.0.79" },
      browserExtension: { version: "1.0.79", firefox: { published: true } },
    },
  }),
}));

vi.mock("../../hooks/useVisitorStats", () => ({
  useVisitorStats: () => ({ stats: { totalEngagement: 10, websiteVisits: 5 }, live: false }),
}));

vi.mock("../../hooks/useUsageStats", () => ({
  useUsageStats: () => ({
    stats: { optInUniques: { activeNow: 1, unique24h: 2, uniqueAll: 3, unique1h: 1 } },
    live: false,
  }),
}));

describe("Overview (ADMIN-05 dedupe)", () => {
  it("does not duplicate footer-owned sync badge or package version KPI", () => {
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );

    expect(screen.queryByText("Package Version")).not.toBeInTheDocument();
    expect(screen.queryByText("Connected Services")).not.toBeInTheDocument();
    expect(screen.getByText("Service connectivity")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Settings → Services/i })).toBeInTheDocument();
  });
});
