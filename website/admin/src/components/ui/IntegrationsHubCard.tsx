import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import SectionReferLink from "./SectionReferLink";
import { fetchCredSyncStatusApi, fetchHealth, fetchGithubConfigApi } from "../../lib/api";

type HubRow = {
  id: string;
  label: string;
  tab: string;
  status: string;
  variant: "synced" | "warn" | "danger";
};

export default function IntegrationsHubCard() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HubRow[]>([]);

  useEffect(() => {
    Promise.all([fetchHealth(), fetchCredSyncStatusApi(), fetchGithubConfigApi()])
      .then(([health, credSync, github]) => {
        const next: HubRow[] = [
          {
            id: "mail",
            label: "Mail transport",
            tab: "mail",
            status: health.mailConfigured ? String(health.mailTransport ?? "ready") : "Not configured",
            variant: health.mailConfigured ? "synced" : "danger",
          },
          {
            id: "mail-audit",
            label: "Email deliverability",
            tab: "mail",
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
            tab: "discord",
            status: health.discordConfigured ? "Deployment hook" : "Not configured",
            variant: health.discordConfigured ? "synced" : "warn",
          },
          {
            id: "social",
            label: "Social channels",
            tab: "social",
            status: health.socialConfigured
              ? `${health.socialEnabledCount ?? 0} enabled`
              : "Not configured",
            variant: health.socialConfigured ? "synced" : "warn",
          },
          {
            id: "github",
            label: "GitHub webhooks",
            tab: "github",
            status: github.config.webhookConfigured
              ? `${github.config.recentWebhookEvents?.length ?? 0} recent events`
              : "Secret pending save",
            variant: github.config.webhookConfigured ? "synced" : "warn",
          },
          {
            id: "cred",
            label: "Cred vault sync",
            tab: "cred-vault",
            status: credSync.status.neverMiss ? "Never miss" : credSync.status.lastSyncOk ? "Last OK" : "Check drift",
            variant: credSync.status.neverMiss ? "synced" : credSync.status.lastSyncOk ? "synced" : "warn",
          },
        ];
        setRows(next);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <LayoutGrid size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Integrations hub
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Unified status for mail, Discord, social, GitHub webhooks, and cred sync — jump to any tab to configure.
          </p>
        </div>
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading integration status…" />
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
                <SectionReferLink section="settings" settingsTab={row.tab as import("./settings-tab-storage").SettingsTabId} label={row.label} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
