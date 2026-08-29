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

vi.mock("../context/DeployRuntimeContext", () => ({
  useDeployRuntime: () => ({
    inProgress: false,
    startSession: vi.fn(),
    registerOnDeployComplete: vi.fn(),
  }),
}));

vi.mock("../lib/api", () => ({
  fetchTags: vi.fn().mockResolvedValue({
    tags: ["v1.0.31", "v1.0.35", "v1.0.51"],
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
  });

  it("shows Deployment validation section and Validate platforms button", async () => {
    render(<Deployments />);
    expect(await screen.findByRole("heading", { name: "Deployment validation" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /validate marketplace platforms before deployment/i })
    ).toHaveTextContent("Validate platforms");
  });

  it("keeps a manually selected deploy tag instead of snapping back to the prepared tag", async () => {
    render(<Deployments />);

    const select = await screen.findByLabelText("Deploy tag");
    await waitFor(() => expect(select).toHaveValue("v1.0.35"));

    fireEvent.change(select, { target: { value: "v1.0.51" } });
    expect(select).toHaveValue("v1.0.51");

    await waitFor(() => expect(select).toHaveValue("v1.0.51"));
  });
});
