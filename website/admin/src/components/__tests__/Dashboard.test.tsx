import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { startTestDataServer, type TestDataServer } from "../../test-support/test-server";
import { getTestAdminEmail } from "../../test-support/env";
import { formatCount } from "../../lib/site-data";

const firebaseMock = vi.hoisted(() => {
  const email = (
    process.env.ADMIN_MASTER_EMAIL ||
    process.env.VITE_ADMIN_MASTER_EMAIL ||
    (process.env.CI === "true" ? "ci-admin@lorapok.test" : "")
  )
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error(
      "Admin test email is not configured. Set ADMIN_MASTER_EMAIL or VITE_ADMIN_MASTER_EMAIL."
    );
  }

  const user = {
    email,
    getIdToken: vi.fn().mockResolvedValue("vitest-session-token"),
  };

  return {
    auth: {
      onAuthStateChanged: vi.fn((cb: (u: typeof user) => void) => {
        cb(user);
        return vi.fn();
      }),
      currentUser: user,
      signOut: vi.fn(),
    },
    db: {},
  };
});

vi.mock("../../lib/firebase", () => firebaseMock);

let testServer: TestDataServer;
let DashboardLayout: typeof import("../Dashboard").default;

beforeAll(async () => {
  testServer = await startTestDataServer();
  vi.stubEnv("VITE_API_BASE", testServer.apiBase);
  vi.stubEnv("VITE_SITE_DATA_URL", testServer.siteDataUrl);
  vi.resetModules();
  DashboardLayout = (await import("../Dashboard")).default;
});

afterAll(async () => {
  await testServer?.close();
  vi.unstubAllEnvs();
});

function renderDashboard(path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/*" element={<DashboardLayout />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Dashboard Component", () => {
  it("renders sidebar navigation items", () => {
    renderDashboard();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Marketplace")).toBeInTheDocument();
    expect(screen.getByText("Releases")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Deployments")).toBeInTheDocument();
    expect(screen.getByText("Notices")).toBeInTheDocument();
    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("API Activity")).toBeInTheDocument();
    expect(screen.getByText("API Explorer")).toBeInTheDocument();
    expect(screen.getByText("Team Access")).toBeInTheDocument();
  });

  it("shows the configured admin email in the sidebar", () => {
    renderDashboard();
    expect(screen.getByText(getTestAdminEmail())).toBeInTheDocument();
  });

  it("serves live site-data.json for dashboard KPIs", async () => {
    const res = await fetch(testServer.siteDataUrl);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { downloads: { total: number } };
    expect(formatCount(data.downloads.total)).toBe(
      formatCount(testServer.siteData.downloads.total)
    );
  });

  it("reads admin roster from the dev API (Cloudflare KV mirror)", async () => {
    const res = await fetch(`${testServer.apiBase}/admins`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { emails: string[]; source: string };
    expect(body).toHaveProperty("emails");
    expect(Array.isArray(body.emails)).toBe(true);
    expect(body.source).toBe("local-file");
  });
});
