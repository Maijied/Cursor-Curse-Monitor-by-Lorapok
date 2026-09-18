import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return {
    ...actual,
    fetchServiceAnalyticsApi: vi.fn().mockResolvedValue({
      generatedAt: "2026-09-18T00:00:00.000Z",
      overall: "online",
      cards: [
        {
          id: "cloudflare-kv",
          label: "Cloudflare KV",
          category: "cloudflare",
          status: "ok",
          summary: "ADMIN_KV bound",
          metrics: [{ label: "Configured", value: "yes" }],
        },
      ],
    }),
  };
});

describe("Overview (ADMIN-05 dedupe + ANALYTICS-01 hub)", () => {
  it("does not duplicate footer-owned sync badge or package version KPI", async () => {
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );

    expect(screen.queryByText("Package Version")).not.toBeInTheDocument();
    expect(screen.queryByText("Connected Services")).not.toBeInTheDocument();
    expect(screen.queryByText("Service connectivity")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Service analytics hub")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Go to Settings → Services/i })).toBeInTheDocument();
  });
});
