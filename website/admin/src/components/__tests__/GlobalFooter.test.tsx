import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GlobalFooter from "../layout/GlobalFooter";

describe("GlobalFooter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows services online, version, sync label, and Lorapok Labs link", async () => {
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
              }),
          };
        }
        if (url.includes("/sync/status")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                overall: "online",
                stats: { cache: { fresh: true }, kvQuotaHit: false },
              }),
          };
        }
        if (url.includes("site-data")) {
          return {
            ok: true,
            json: async () => ({
              generatedAt: "2026-09-08T14:00:00.000Z",
              version: "1.0.79",
              packageVersion: "1.0.79",
              syncStatus: "synced",
            }),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<GlobalFooter />);

    await waitFor(() => {
      expect(screen.getByText("Services online")).toBeInTheDocument();
      expect(screen.getByText("v1.0.79")).toBeInTheDocument();
      expect(screen.getByText("Synced")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: "Lorapok Labs" });
    expect(link).toHaveAttribute("href", "https://lorapok.tech");
  });

  it("shows offline when health check fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/health")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                ok: false,
                checks: { github: false, timestamp: "2026-09-08T14:00:00.000Z" },
              }),
          };
        }
        if (url.includes("/sync/status")) {
          return {
            ok: true,
            text: async () => JSON.stringify({ overall: "offline", stats: { cache: { fresh: false } } }),
          };
        }
        if (url.includes("site-data")) {
          return {
            ok: true,
            json: async () => ({
              generatedAt: "2026-09-08T14:00:00.000Z",
              version: "1.0.79",
              packageVersion: "1.0.79",
              syncStatus: "drift",
            }),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<GlobalFooter />);

    await waitFor(() => {
      expect(screen.getByText("Offline")).toBeInTheDocument();
      expect(screen.getByText("Drift")).toBeInTheDocument();
    });
  });
});
