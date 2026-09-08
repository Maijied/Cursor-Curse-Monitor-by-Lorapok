import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConnectedServicesCard from "../ui/ConnectedServicesCard";

vi.mock("../../lib/firebase", () => ({
  auth: { currentUser: { email: "admin@lorapok.test" } },
}));

describe("ConnectedServicesCard (ADMIN-05 dedupe)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("omits infrastructure rows owned by InfrastructureStatusCard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/health")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                ok: true,
                checks: { github: true, timestamp: "2026-09-08T14:00:00.000Z" },
                firebaseConfigured: true,
                firebaseProject: "cursor-curse-by-lorapok",
                mailConfigured: true,
                mailTransport: "cloudflare-relay",
                discordConfigured: true,
              }),
          };
        }
        if (url.includes("site-data")) {
          return {
            ok: true,
            json: async () => ({
              version: "1.0.79",
              generatedAt: "2026-09-08T14:00:00.000Z",
              notice: { enabled: false },
            }),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(
      <MemoryRouter>
        <ConnectedServicesCard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("GitHub API")).toBeInTheDocument();
    });

    expect(screen.queryByText("Live stats cron")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin D1")).not.toBeInTheDocument();
  });
});
