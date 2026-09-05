import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LoginInfraPanel from "../LoginInfraPanel";

describe("LoginInfraPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockHealth(payload: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(payload),
      }),
    );
  }

  it("shows invite-only policy and auth methods", () => {
    mockHealth({
      ok: true,
      checks: { github: true, timestamp: "2026-09-05T04:00:00.000Z" },
      firebaseProject: "cursor-curse-by-lorapok",
      firebaseConfigured: true,
      adminD1Configured: true,
      adminD1Ok: true,
      mailConfigured: true,
      adminPublicUrl: "https://cursor-dev.lorapok.tech",
    });

    render(<LoginInfraPanel />);

    expect(screen.getByText(/invite-only/i)).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Magic link")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("loads health indicators from /api/health", async () => {
    mockHealth({
      ok: true,
      checks: { github: false, timestamp: "2026-09-05T04:00:00.000Z" },
      firebaseProject: "cursor-curse-by-lorapok",
      firebaseConfigured: true,
      adminD1Configured: true,
      adminD1Ok: false,
      mailConfigured: false,
      adminPublicUrl: "https://cursor-dev.lorapok.tech",
    });

    render(<LoginInfraPanel />);

    await waitFor(() => {
      expect(screen.getByText(/cursor-curse-by-lorapok/)).toBeInTheDocument();
      expect(screen.getByText(/GitHub: Degraded/i)).toBeInTheDocument();
      expect(screen.getByText(/Mail: Off/i)).toBeInTheDocument();
    });
  });
});
