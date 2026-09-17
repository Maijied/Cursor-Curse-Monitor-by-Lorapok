import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import Settings from "../pages/Settings";
import { AuthContext, type AuthContextValue } from "../../lib/use-auth-session";

vi.mock("../../lib/firebase", () => ({
  auth: {
    currentUser: {
      email: "admin@lorapok.test",
      getIdToken: async () => "test-token",
    },
  },
}));

vi.mock("../../hooks/useSiteData", () => ({
  useSiteData: () => ({ data: null, loading: false, error: null }),
}));

vi.mock("../ui/MailDeliverabilityCard", () => ({
  default: () => <div data-testid="mail-deliverability">MailDeliverabilityCard</div>,
}));
vi.mock("../ui/MailTransportCard", () => ({
  default: () => <div data-testid="mail-transport">MailTransportCard</div>,
}));
vi.mock("../ui/MailSetupChecklist", () => ({
  default: () => <div data-testid="mail-setup">MailSetupChecklist</div>,
}));
vi.mock("../ui/DiscordIntegrationsCard", () => ({
  default: () => <div data-testid="discord-integrations">DiscordIntegrationsCard</div>,
}));
vi.mock("../ui/DiscordCardGallery", () => ({
  default: () => <div data-testid="discord-gallery">DiscordCardGallery</div>,
}));
vi.mock("../ui/DiscordCommunityCard", () => ({
  default: () => <div data-testid="discord-community">DiscordCommunityCard</div>,
}));
vi.mock("../ui/DiscordGithubLogCard", () => ({
  default: () => <div data-testid="discord-github-log">DiscordGithubLogCard</div>,
}));
vi.mock("../ui/DiscordFeedbackCard", () => ({
  default: () => <div data-testid="discord-feedback">DiscordFeedbackCard</div>,
}));
vi.mock("../ui/SocialIntegrationsCard", () => ({
  default: () => <div data-testid="social-integrations">SocialIntegrationsCard</div>,
}));
vi.mock("../ui/SocialAiConfigCard", () => ({
  default: () => <div data-testid="social-ai">SocialAiConfigCard</div>,
}));
vi.mock("../ui/SocialGallery", () => ({
  default: () => <div data-testid="social-gallery">SocialGallery</div>,
}));
vi.mock("../ui/GitHubConfigCard", () => ({
  default: () => <div data-testid="github-config">GitHubConfigCard</div>,
}));
vi.mock("../ui/CredVaultConfigCard", () => ({
  default: () => <div data-testid="cred-vault">CredVaultConfigCard</div>,
}));
vi.mock("../ui/ConnectedServicesCard", () => ({
  default: () => <div data-testid="runtime-auth">RuntimeAuthStub</div>,
}));
vi.mock("../ui/HelpSupportCard", () => ({ default: () => null }));
vi.mock("../ui/InfrastructureStatusCard", () => ({ default: () => null }));
vi.mock("../ui/ProfileSettingsCard", () => ({ default: () => null }));
vi.mock("../ui/EmailIdentitiesCard", () => ({ default: () => null }));
vi.mock("../ui/ResendConfigCard", () => ({ default: () => null }));
vi.mock("../ui/TestmailConfigCard", () => ({ default: () => null }));
vi.mock("../ui/SeoIntegrationsCard", () => ({ default: () => null }));
vi.mock("../ui/FirebaseConfigCard", () => ({ default: () => null }));
vi.mock("../ui/CloudflareConfigCard", () => ({ default: () => null }));
vi.mock("../ui/MarketplaceConfigCard", () => ({ default: () => null }));
vi.mock("../ui/SubscribePromptCard", () => ({ default: () => null }));
vi.mock("../ui/ReindexPolicyCard", () => ({ default: () => null }));
vi.mock("../ui/CronSchedulesCard", () => ({ default: () => null }));
vi.mock("../ui/CloudEnvironmentsCard", () => ({ default: () => null }));

function authValue(): AuthContextValue {
  return {
    user: { email: "admin@lorapok.test" } as User,
    session: {
      email: "admin@lorapok.test",
      role: "master",
      permissions: ["*"],
      isMaster: true,
    } as AuthContextValue["session"],
    loading: false,
    refresh: async () => undefined,
    hasPermission: () => true,
    isMaster: true,
  };
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue()}>
        <Settings />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe("Settings INT-01 manual checklist (hub + dedicated tabs)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("admin-settings-tab", "services");
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
              }),
          };
        }
        if (url.includes("/integrations/cred-sync/status")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({ ok: true, status: { neverMiss: true, lastSyncOk: true } }),
          };
        }
        if (url.includes("/integrations/github/config")) {
          return {
            ok: true,
            text: async () =>
              JSON.stringify({
                ok: true,
                config: { webhookConfigured: true, recentWebhookEvents: [] },
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
                  activeProviderId: "svg-fallback",
                  providers: [],
                  video: { enabled: false },
                  updatedAt: null,
                  updatedBy: null,
                },
              }),
          };
        }
        return { ok: true, text: async () => "{}" };
      })
    );
  });

  it("switches hub panes via Configure and Open tab to dedicated Settings tabs", async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByText("Integrations hub")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Mail transport")).toBeInTheDocument();
    });

    // Hub pane: Configure → Mail embeds deliverability + transport
    const mailRow = screen.getByText("Mail transport").closest("li");
    expect(mailRow).toBeTruthy();
    fireEvent.click(within(mailRow as HTMLElement).getByRole("button", { name: "Configure" }));
    expect(screen.getByTestId("mail-deliverability")).toBeInTheDocument();
    expect(screen.getByTestId("mail-transport")).toBeInTheDocument();

    // Back to overview, then Open tab → Mail settings tab (dedicated cards)
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    await waitFor(() => {
      expect(screen.getByText("Mail transport")).toBeInTheDocument();
    });
    const mailRow2 = screen.getByText("Mail transport").closest("li");
    fireEvent.click(within(mailRow2 as HTMLElement).getByRole("button", { name: "Open tab" }));

    expect(screen.getByRole("tab", { name: "Mail", selected: true })).toBeInTheDocument();
    expect(screen.getByTestId("mail-deliverability")).toBeInTheDocument();
    expect(screen.getByTestId("mail-setup")).toBeInTheDocument();
    expect(screen.getByTestId("mail-transport")).toBeInTheDocument();

    // Dedicated Discord tab still renders its cards
    fireEvent.click(screen.getByRole("tab", { name: "Discord" }));
    expect(screen.getByTestId("discord-gallery")).toBeInTheDocument();
    expect(screen.getByTestId("discord-community")).toBeInTheDocument();
    expect(screen.getByTestId("discord-integrations")).toBeInTheDocument();
    expect(screen.getByTestId("discord-feedback")).toBeInTheDocument();

    // Dedicated Social tab still renders its cards
    fireEvent.click(screen.getByRole("tab", { name: "Social" }));
    expect(screen.getByTestId("social-gallery")).toBeInTheDocument();
    expect(screen.getByTestId("social-ai")).toBeInTheDocument();
    expect(screen.getByTestId("social-integrations")).toBeInTheDocument();
  });
});
