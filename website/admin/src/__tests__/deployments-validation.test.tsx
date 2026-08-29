import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Deployments from "../components/pages/Deployments";

vi.mock("../lib/firebase", () => ({
  auth: { currentUser: { email: "mdshuvo40@gmail.com" } },
}));

vi.mock("../lib/admin-config", () => ({
  isMasterAdmin: () => true,
}));

vi.mock("../hooks/useSiteData", () => ({
  useSiteData: () => ({
    data: {
      packageVersion: "1.0.26",
      github: { releaseTag: "v1.0.31", tags: ["v1.0.31"] },
      browserExtension: { firefox: { published: false, reviewStatus: "awaiting-review" } },
    },
  }),
}));

let triggerDeployComplete: (() => void) | null = null;

vi.mock("../context/DeployRuntimeContext", () => ({
  useDeployRuntime: () => ({
    inProgress: false,
    startSession: vi.fn(),
    registerOnDeployComplete: (cb: (() => void) | null) => {
      triggerDeployComplete = cb;
    },
  }),
}));

vi.mock("../lib/api", () => ({
  fetchTags: vi.fn().mockResolvedValue({
    tags: ["v1.0.31", "v1.0.35", "v1.0.51", "v1.0.34-dev.5"],
    liveTag: "v1.0.31",
    latestTag: "v1.0.51",
    suggestedTag: "v1.0.35",
  }),
  fetchVersionPlan: vi.fn().mockResolvedValue({
    summary: "Platforms checked",
    recommendedTag: "v1.0.35",
    reasons: [{ id: "github", label: "GitHub", liveVersion: "1.0.31", status: "synced", reason: "ok" }],
    checkedAt: new Date().toISOString(),
  }),
  triggerDeployment: vi.fn(),
  triggerInfraDeploy: vi.fn(),
  triggerRollback: vi.fn(),
}));

vi.mock("../components/ui/DiscordIntegrationsCard", () => ({
  default: () => <div data-testid="discord-card">Discord</div>,
}));

vi.mock("../components/ui/DeployRuntimeInlineSlot", () => ({
  default: () => <div data-testid="deploy-runtime-slot" />,
}));

describe("Deployments validation UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerDeployComplete = null;
  });

  it("shows Deployment validation section and Validate platforms button", async () => {
    render(<Deployments />);
    expect(await screen.findByRole("heading", { name: "Deployment validation" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /validate marketplace platforms before deployment/i })
    ).toHaveTextContent("Validate platforms");
  });

  it("keeps a manually selected deploy tag instead of snapping back to the prepared tag", async () => {
    const { useDeployRuntime } = await import("../context/DeployRuntimeContext");
    render(<Deployments />);

    const select = await screen.findByLabelText("Deploy tag");
    await waitFor(() => expect(select).toHaveValue("v1.0.35"));

    fireEvent.change(select, { target: { value: "v1.0.51" } });
    expect(select).toHaveValue("v1.0.51");

    triggerDeployComplete?.();
    await waitFor(() => expect(select).toHaveValue("v1.0.51"));
  });

  it("lists semver tags on beta channel (not CI-only tags)", async () => {
    render(<Deployments />);
    const betaRadio = await screen.findByRole("radio", { name: /beta \(pre-release\)/i });
    fireEvent.click(betaRadio);
    const select = await screen.findByLabelText("Deploy tag");
    await waitFor(() => {
      expect(select.querySelectorAll("option").length).toBeGreaterThan(0);
    });
    const optionValues = Array.from(select.querySelectorAll("option")).map((o) => o.getAttribute("value"));
    expect(optionValues).not.toContain("v1.0.34-dev.5");
    expect(optionValues).toContain("v1.0.51");
    expect(screen.getByText(/Beta channel/i)).toBeInTheDocument();
    expect(screen.getByText(/Firefox AMO is not available on beta/i)).toBeInTheDocument();
  });

  it("blocks deploy when beta channel is selected with default AMO market", async () => {
    render(<Deployments />);
    const betaRadio = await screen.findByRole("radio", { name: /beta \(pre-release\)/i });
    fireEvent.click(betaRadio);
    const submit = await screen.findByRole("button", { name: /publish to marketplaces/i });
    expect(submit).toBeDisabled();
  });
});
