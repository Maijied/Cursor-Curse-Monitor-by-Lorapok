import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IntegrationsHubCard from "../ui/IntegrationsHubCard";

vi.mock("../../lib/firebase", () => ({
  auth: {
    currentUser: {
      email: "admin@lorapok.test",
      getIdToken: async () => "test-token",
    },
  },
}));

vi.mock("../../lib/use-auth-session", () => ({
  useAuthSession: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("../ui/MailDeliverabilityCard", () => ({
  default: () => <div>MailDeliverabilityCard</div>,
}));
vi.mock("../ui/MailTransportCard", () => ({
  default: () => <div>MailTransportCard</div>,
}));
vi.mock("../ui/DiscordIntegrationsCard", () => ({
  default: () => <div>DiscordIntegrationsCard</div>,
}));
vi.mock("../ui/SocialIntegrationsCard", () => ({
  default: () => <div>SocialIntegrationsCard</div>,
}));
vi.mock("../ui/SocialAiConfigCard", () => ({
  default: () => <div>SocialAiConfigCard</div>,
}));
vi.mock("../ui/GitHubConfigCard", () => ({
  default: () => <div>GitHubConfigCard</div>,
}));
vi.mock("../ui/CredVaultConfigCard", () => ({
  default: () => <div>CredVaultConfigCard</div>,
}));

describe("IntegrationsHubCard (INT-01)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("shows overview status rows and opens a config pane", async () => {
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
                checks: { github: true, timestamp: "2026-09-17T12:00:00.000Z" },
                mailConfigured: true,
                mailTransport: "resend",
                mailDeliverabilityOk: true,
                discordConfigured: true,
                socialConfigured: true,
                socialEnabledCount: 2,
                githubWebhookConfigured: true,
                githubWebhookRecentCount: 3,
                credSync: { neverMiss: true, lastSyncOk: true },
              }),
          };
        }
        if (url.includes("/integrations/cred-sync/status")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                ok: true,
                status: { neverMiss: true, lastSyncOk: true },
              }),
          };
        }
        if (url.includes("/integrations/github/config")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                ok: true,
                config: { webhookConfigured: true, recentWebhookEvents: [{ id: "1" }] },
              }),
          };
        }
        if (url.includes("/integrations/social/ai/config")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                ok: true,
                config: {
                  activeProviderId: "openai",
                  providers: [],
                  video: { enabled: false },
                  updatedAt: null,
                  updatedBy: null,
                },
              }),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <IntegrationsHubCard onOpenSettingsTab={onOpen} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Mail transport")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Image AI" })).toBeInTheDocument();
    expect(screen.getByText("openai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Mail" }));
    expect(screen.getByText("MailDeliverabilityCard")).toBeInTheDocument();
    expect(screen.getByText("MailTransportCard")).toBeInTheDocument();
  });
});
