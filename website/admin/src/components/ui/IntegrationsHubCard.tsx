import { useEffect, useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import SectionReferLink from "./SectionReferLink";
import DiscordIntegrationsCard from "./DiscordIntegrationsCard";
import SocialIntegrationsCard from "./SocialIntegrationsCard";
import SocialAiConfigCard from "./SocialAiConfigCard";
import GitHubConfigCard from "./GitHubConfigCard";
import CredVaultConfigCard from "./CredVaultConfigCard";
import MailTransportCard from "./MailTransportCard";
import MailDeliverabilityCard from "./MailDeliverabilityCard";
import {
  fetchCredSyncStatusApi,
  fetchGithubConfigApi,
  fetchHealth,
  fetchSocialAiConfigApi,
} from "../../lib/api";
import { canAccessFeature, SETTINGS_TAB_PERMISSIONS } from "../../lib/nav-permissions";
import { useAuthSession } from "../../lib/use-auth-session";
import type { SettingsTabId } from "./settings-tab-storage";

export type HubPaneId = "overview" | "mail" | "discord" | "social" | "github" | "cred" | "image-ai";

type HubRow = {
  id: string;
  label: string;
  pane: HubPaneId;
  settingsTab: SettingsTabId;
  status: string;
  variant: "synced" | "warn" | "danger";
};

const HUB_PANES: { id: HubPaneId; label: string; settingsTab: SettingsTabId | null }[] = [
  { id: "overview", label: "Overview", settingsTab: null },
  { id: "mail", label: "Mail", settingsTab: "mail" },
  { id: "discord", label: "Discord", settingsTab: "discord" },
  { id: "social", label: "Social", settingsTab: "social" },
  { id: "image-ai", label: "Image AI", settingsTab: "social" },
  { id: "github", label: "GitHub", settingsTab: "github" },
  { id: "cred", label: "Cred sync", settingsTab: "cred-vault" },
];

const HUB_PANE_STORAGE_KEY = "ccm-integrations-hub-pane";

function readHubPane(): HubPaneId {
  try {
    const raw = localStorage.getItem(HUB_PANE_STORAGE_KEY);
    if (HUB_PANES.some((p) => p.id === raw)) return raw as HubPaneId;
  } catch {
    /* ignore */
  }
  return "overview";
}

type IntegrationsHubCardProps = {
  /** Jump to a top-level Settings tab (deep link outside the hub). */
  onOpenSettingsTab?: (tab: SettingsTabId) => void;
};

/**
 * Unified integrations surface (INT-01) — status overview plus in-hub config panes
 * for mail, Discord, social, image AI, GitHub webhooks, and cred sync.
 */
export default function IntegrationsHubCard({ onOpenSettingsTab }: IntegrationsHubCardProps) {
  const { hasPermission } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HubRow[]>([]);
  const [pane, setPane] = useState<HubPaneId>(() => readHubPane());

  const visiblePanes = useMemo(
    () =>
      HUB_PANES.filter((p) => {
        if (!p.settingsTab) return true;
        return canAccessFeature(hasPermission, SETTINGS_TAB_PERMISSIONS[p.settingsTab]);
      }),
    [hasPermission]
  );

  useEffect(() => {
    if (!visiblePanes.some((p) => p.id === pane)) {
      setPane("overview");
    }
  }, [pane, visiblePanes]);

  useEffect(() => {
    try {
      localStorage.setItem(HUB_PANE_STORAGE_KEY, pane);
    } catch {
      /* ignore */
    }
  }, [pane]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchHealth(),
      fetchCredSyncStatusApi().catch(() => null),
      fetchGithubConfigApi().catch(() => null),
      fetchSocialAiConfigApi().catch(() => null),
    ])
      .then(([health, credSync, github, socialAi]) => {
        if (cancelled) return;
        const aiProvider = socialAi?.config?.activeProviderId;
        const aiReady = Boolean(aiProvider && aiProvider !== "svg-fallback");
        const next: HubRow[] = [
          {
            id: "mail",
            label: "Mail transport",
            pane: "mail",
            settingsTab: "mail",
            status: health.mailConfigured ? String(health.mailTransport ?? "ready") : "Not configured",
            variant: health.mailConfigured ? "synced" : "danger",
          },
          {
            id: "mail-audit",
            label: "Email deliverability",
            pane: "mail",
            settingsTab: "mail",
            status: health.mailDeliverabilityOk
              ? "Verified"
              : health.mailLastVerifiedAt
                ? "Stale / failed"
                : "Not audited",
            variant: health.mailDeliverabilityOk ? "synced" : "warn",
          },
          {
            id: "discord",
            label: "Discord",
            pane: "discord",
            settingsTab: "discord",
            status: health.discordConfigured ? "Deployment hook" : "Not configured",
            variant: health.discordConfigured ? "synced" : "warn",
          },
          {
            id: "social",
            label: "Social channels",
            pane: "social",
            settingsTab: "social",
            status: health.socialConfigured
              ? `${health.socialEnabledCount ?? 0} enabled`
              : "Not configured",
            variant: health.socialConfigured ? "synced" : "warn",
          },
          {
            id: "image-ai",
            label: "Image AI",
            pane: "image-ai",
            settingsTab: "social",
            status: aiProvider ? (aiReady ? aiProvider : "SVG fallback") : "Unavailable",
            variant: aiReady ? "synced" : "warn",
          },
          {
            id: "github",
            label: "GitHub webhooks",
            pane: "github",
            settingsTab: "github",
            status: github?.config.webhookConfigured
              ? `${github.config.recentWebhookEvents?.length ?? 0} recent events`
              : health.githubWebhookConfigured
                ? `${health.githubWebhookRecentCount ?? 0} recent events`
                : "Secret pending save",
            variant:
              github?.config.webhookConfigured || health.githubWebhookConfigured ? "synced" : "warn",
          },
          {
            id: "cred",
            label: "Cred vault sync",
            pane: "cred",
            settingsTab: "cred-vault",
            status: credSync?.status.neverMiss
              ? "Never miss"
              : credSync?.status.lastSyncOk
                ? "Last OK"
                : health.credSync?.neverMiss
                  ? "Never miss"
                  : "Check drift",
            variant:
              credSync?.status.neverMiss || health.credSync?.neverMiss
                ? "synced"
                : credSync?.status.lastSyncOk || health.credSync?.lastSyncOk
                  ? "synced"
                  : "warn",
          },
        ];
        setRows(
          next.filter((row) =>
            canAccessFeature(hasPermission, SETTINGS_TAB_PERMISSIONS[row.settingsTab])
          )
        );
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasPermission]);

  const onSelectPane = (next: HubPaneId) => {
    setPane(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <LayoutGrid size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
              Integrations hub
            </h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              One place to review and configure Discord, social, image AI, GitHub webhooks, mail, and
              cred sync. Dedicated Settings tabs remain available for deep links.
            </p>
          </div>
        </div>

        <div
          className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-thin"
          role="tablist"
          aria-label="Integration hub panes"
        >
          {visiblePanes.map((p) => {
            const selected = p.id === pane;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelectPane(p.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  selected
                    ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-white/5 hover:text-[var(--color-text)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {pane === "overview" && (
          <div role="tabpanel" aria-label="Integrations overview">
            {loading ? (
              <LorapokLarvaeLoader label="Loading integration status…" />
            ) : rows.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No integration status available.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
                  >
                    <span className="text-sm font-medium">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.variant}>{row.status}</Badge>
                      <button
                        type="button"
                        className="text-xs text-[var(--color-accent)] hover:underline"
                        onClick={() => onSelectPane(row.pane)}
                      >
                        Configure
                      </button>
                      {onOpenSettingsTab ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--color-muted)] hover:underline"
                          onClick={() => onOpenSettingsTab(row.settingsTab)}
                        >
                          Open tab
                        </button>
                      ) : (
                        <SectionReferLink
                          section="settings"
                          settingsTab={row.settingsTab}
                          label={row.label}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {pane === "mail" && (
        <div className="space-y-4" role="tabpanel" aria-label="Mail integrations">
          <MailDeliverabilityCard />
          <MailTransportCard />
        </div>
      )}
      {pane === "discord" && (
        <div role="tabpanel" aria-label="Discord integrations">
          <DiscordIntegrationsCard />
        </div>
      )}
      {pane === "social" && (
        <div role="tabpanel" aria-label="Social integrations">
          <SocialIntegrationsCard />
        </div>
      )}
      {pane === "image-ai" && (
        <div role="tabpanel" aria-label="Image AI integrations">
          <SocialAiConfigCard />
        </div>
      )}
      {pane === "github" && (
        <div role="tabpanel" aria-label="GitHub integrations">
          <GitHubConfigCard />
        </div>
      )}
      {pane === "cred" && (
        <div role="tabpanel" aria-label="Cred vault sync">
          <CredVaultConfigCard />
        </div>
      )}
    </div>
  );
}
