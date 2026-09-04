import { useEffect, useState } from "react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ConnectedServicesCard from "../ui/ConnectedServicesCard";
import DiscordFeedbackCard from "../ui/DiscordFeedbackCard";
import DiscordCommunityCard from "../ui/DiscordCommunityCard";
import DiscordIntegrationsCard from "../ui/DiscordIntegrationsCard";
import MailSetupChecklist from "../ui/MailSetupChecklist";
import MailTransportCard from "../ui/MailTransportCard";
import SubscribePromptCard from "../ui/SubscribePromptCard";
import ReindexPolicyCard from "../ui/ReindexPolicyCard";
import CronSchedulesCard from "../ui/CronSchedulesCard";
import HelpSupportCard from "../ui/HelpSupportCard";
import InfrastructureStatusCard from "../ui/InfrastructureStatusCard";
import CloudEnvironmentsCard from "../ui/CloudEnvironmentsCard";
import FirebaseConfigCard from "../ui/FirebaseConfigCard";
import GitHubConfigCard from "../ui/GitHubConfigCard";
import CloudflareConfigCard from "../ui/CloudflareConfigCard";
import ResendConfigCard from "../ui/ResendConfigCard";
import EmailIdentitiesCard from "../ui/EmailIdentitiesCard";
import TestmailConfigCard from "../ui/TestmailConfigCard";
import CredVaultConfigCard from "../ui/CredVaultConfigCard";
import MarketplaceConfigCard from "../ui/MarketplaceConfigCard";
import ProfileSettingsCard from "../ui/ProfileSettingsCard";
import SettingsTabNav, { persistSettingsTab, readSettingsTab, type SettingsTabId } from "../ui/SettingsTabNav";
import { fetchHealth } from "../../lib/api";
import { useSiteData } from "../../hooks/useSiteData";
import { formatDownloadCount, getDisplayDownloadTotal, downloadStatsAvailabilityLabel } from "../../lib/download-stats";

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "profile", label: "Profile" },
  { id: "mail", label: "Mail" },
  { id: "identities", label: "Email identities" },
  { id: "resend", label: "Resend" },
  { id: "testmail", label: "Testmail" },
  { id: "discord", label: "Discord" },
  { id: "firebase", label: "Firebase" },
  { id: "github", label: "GitHub" },
  { id: "cloudflare", label: "Cloudflare" },
  { id: "cred-vault", label: "Cred vault" },
  { id: "marketplace", label: "Marketplace" },
  { id: "automation", label: "Automation" },
  { id: "cloud-dev", label: "Cloud dev" },
  { id: "services", label: "Services" },
];

/**
 * Renders the application settings page with tabbed service sections.
 */
export default function Settings() {
  const { data: siteData } = useSiteData();
  const [tab, setTab] = useState<SettingsTabId>(() => readSettingsTab());
  const [health, setHealth] = useState<
    (Awaited<ReturnType<typeof fetchHealth>> & {
      githubTokenConfigured?: boolean;
      adminKvConfigured?: boolean;
      siteDataUrl?: string;
      adminPublicUrl?: string;
    }) | null
  >(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("admin-theme") as "dark" | "light") || "dark");

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("admin-theme", theme);
  }, [theme]);

  const onTabChange = (next: SettingsTabId) => {
    setTab(next);
    persistSettingsTab(next);
  };

  const ext = siteData?.browserExtension;

  return (
    <div className="space-y-6 animate-fade-slide-up">
      <PageHeader
        title="Settings"
        description="Configure every integration — mail, Resend, testmail, Discord, Firebase, GitHub, Cloudflare, cred vault, marketplaces, and automation."
      />

      <SettingsTabNav tabs={TABS} active={tab} onChange={onTabChange} />

      {tab === "general" && (
        <>
          <HelpSupportCard />
          <InfrastructureStatusCard />
          <Card>
            <h3 className="font-semibold mb-4">Theme</h3>
            <div className="flex gap-3">
              {(["dark", "light"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={`px-4 py-2 rounded-xl border capitalize transition-all ${
                    theme === value
                      ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-white/5"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4">Environment</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-muted)] shrink-0">Admin URL</dt>
                <dd className="font-[family-name:var(--font-mono)] text-xs text-right break-all">
                  {health?.adminPublicUrl ?? "https://cursor-dev.lorapok.tech"}
                </dd>
              </div>
              {siteData && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-muted)]">Total downloads</dt>
                    <dd className="text-right">
                      <span className="font-semibold text-[var(--color-neon)]">
                        {formatDownloadCount(getDisplayDownloadTotal(siteData))}
                      </span>
                      <span className="block text-[10px] text-[var(--color-muted)] mt-0.5">
                        {downloadStatsAvailabilityLabel(siteData)}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-muted)]">Site data synced</dt>
                    <dd>{new Date(siteData.generatedAt).toLocaleString()}</dd>
                  </div>
                </>
              )}
              {ext && (
                <>
                  <div className="flex justify-between items-center gap-4">
                    <dt className="text-[var(--color-muted)]">Firefox AMO</dt>
                    <dd>
                      <Badge variant={ext.firefox?.published ? "synced" : "warn"}>
                        {ext.firefox?.published ? `v${ext.version ?? "—"} live` : "Pending"}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <dt className="text-[var(--color-muted)]">Chrome Web Store</dt>
                    <dd>
                      <Badge variant="warn">Zip only — not published</Badge>
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </Card>
          <Card>
            <h3 className="font-semibold mb-4">API Health</h3>
            {health ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <dt className="text-[var(--color-muted)]">GitHub API</dt>
                  <dd>
                    <Badge variant={health.checks.github ? "synced" : "danger"}>
                      {health.checks.github ? "OK" : "Down"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Firebase project</dt>
                  <dd className="font-[family-name:var(--font-mono)]">{health.firebaseProject}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted)]">Last check</dt>
                  <dd>{new Date(health.checks.timestamp).toLocaleString()}</dd>
                </div>
                {health.githubTokenConfigured != null && (
                  <div className="flex justify-between items-center">
                    <dt className="text-[var(--color-muted)]">GitHub token (server)</dt>
                    <dd>
                      <Badge variant={health.githubTokenConfigured ? "synced" : "warn"}>
                        {health.githubTokenConfigured ? "Configured" : "Missing"}
                      </Badge>
                    </dd>
                  </div>
                )}
                {health.adminKvConfigured != null && (
                  <div className="flex justify-between items-center">
                    <dt className="text-[var(--color-muted)]">Admin KV (team sync)</dt>
                    <dd>
                      <Badge variant={health.adminKvConfigured ? "synced" : "warn"}>
                        {health.adminKvConfigured ? "Configured" : "Use ADMIN_EMAILS"}
                      </Badge>
                    </dd>
                  </div>
                )}
                {health.mailConfigured != null && (
                  <div className="flex justify-between items-center">
                    <dt className="text-[var(--color-muted)]">Mailbox transport</dt>
                    <dd>
                      <Badge
                        variant={
                          !health.mailConfigured
                            ? "warn"
                            : health.mailRelayBound
                              ? "synced"
                              : health.mailTransport === "cloudflare-rest"
                                ? "warn"
                                : "synced"
                        }
                      >
                        {health.mailConfigured ? health.mailTransport ?? "configured" : "Not configured"}
                      </Badge>
                    </dd>
                  </div>
                )}
                {health.mailHint &&
                  (health.mailConfigured ? health.mailTransport === "cloudflare-rest" && !health.mailRelayBound : true) && (
                    <p className="text-xs text-[var(--color-muted)] pt-1">{health.mailHint}</p>
                  )}
                {health.cronSecretConfigured != null && (
                  <div className="flex justify-between items-center">
                    <dt className="text-[var(--color-muted)]">Cron secret (worker)</dt>
                    <dd>
                      <Badge variant={health.cronSecretConfigured ? "synced" : "warn"}>
                        {health.cronSecretConfigured ? "Configured" : "Missing"}
                      </Badge>
                    </dd>
                  </div>
                )}
                {health.statsRefreshEnabled != null && (
                  <div className="flex justify-between items-center gap-4">
                    <dt className="text-[var(--color-muted)]">Stats refresh cron</dt>
                    <dd>
                      <Badge variant={health.statsRefreshEnabled ? "synced" : "warn"}>
                        {health.statsRefreshEnabled
                          ? `Every ${health.statsRefreshIntervalMinutes ?? "?"} min`
                          : "Paused"}
                      </Badge>
                    </dd>
                  </div>
                )}
                {health.discordDigestEnabled != null && (
                  <div className="flex justify-between items-center gap-4">
                    <dt className="text-[var(--color-muted)]">Discord digest cron</dt>
                    <dd>
                      <Badge variant={health.discordDigestEnabled ? "synced" : "warn"}>
                        {health.discordDigestEnabled
                          ? `Every ${health.discordDigestIntervalMinutes ?? "?"} min`
                          : "Paused"}
                      </Badge>
                    </dd>
                  </div>
                )}
                {health.siteDataUrl && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-muted)] shrink-0">Site data URL</dt>
                    <dd className="font-[family-name:var(--font-mono)] text-xs text-right break-all">{health.siteDataUrl}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">Health check unavailable in this environment.</p>
            )}
          </Card>
        </>
      )}

      {tab === "profile" && <ProfileSettingsCard />}

      {tab === "mail" && (
        <>
          <MailSetupChecklist />
          <MailTransportCard />
        </>
      )}

      {tab === "identities" && <EmailIdentitiesCard />}
      {tab === "resend" && <ResendConfigCard />}
      {tab === "testmail" && <TestmailConfigCard />}

      {tab === "discord" && (
        <>
          <p className="text-sm text-[var(--color-muted)] -mt-2">
            Lorapok Labs Family community hook, deployment status, and feedback prompts.
          </p>
          <DiscordCommunityCard />
          <DiscordIntegrationsCard />
          <DiscordFeedbackCard />
        </>
      )}

      {tab === "firebase" && <FirebaseConfigCard />}
      {tab === "github" && <GitHubConfigCard />}
      {tab === "cloudflare" && <CloudflareConfigCard />}
      {tab === "cred-vault" && <CredVaultConfigCard />}
      {tab === "marketplace" && <MarketplaceConfigCard />}

      {tab === "automation" && (
        <>
          <SubscribePromptCard />
          <ReindexPolicyCard />
          <CronSchedulesCard />
        </>
      )}

      {tab === "cloud-dev" && <CloudEnvironmentsCard />}
      {tab === "services" && (
        <>
          <Card>
            <h3 className="font-semibold mb-2">Integration directory</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Jump to a service tab to rotate secrets or review status.
            </p>
            <div className="flex flex-wrap gap-2">
              {TABS.filter((t) => t.id !== "services" && t.id !== "general").map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Card>
          <ConnectedServicesCard />
        </>
      )}
    </div>
  );
}
