import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../layout/PageHeader";
import Card, { PageSection } from "../ui/Card";
import Badge from "../ui/Badge";
import InstallAppButton from "../ui/InstallAppButton";
import ConnectedServicesCard from "../ui/ConnectedServicesCard";
import { fetchHealth } from "../../lib/api";

const GA_KEY = "admin-ga-measurement-id";

type HealthPayload = Awaited<ReturnType<typeof fetchHealth>> & {
  githubTokenConfigured?: boolean;
  adminKvConfigured?: boolean;
  siteDataUrl?: string;
  resendConfigured?: boolean;
};

export default function Settings() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("admin-theme") as "dark" | "light") || "dark"
  );
  const [gaId, setGaId] = useState("");
  const [gaSaved, setGaSaved] = useState(false);
  const [gaHasStored, setGaHasStored] = useState(() => Boolean(localStorage.getItem(GA_KEY)));

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("admin-theme", theme);
  }, [theme]);

  function saveGa(e: FormEvent) {
    e.preventDefault();
    const value = gaId.trim();
    localStorage.setItem(GA_KEY, value);
    setGaHasStored(Boolean(value));
    setGaId("");
    setGaSaved(true);
    setTimeout(() => setGaSaved(false), 2000);
  }

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader title="Settings" description="Appearance, connections, and environment." />

      <PageSection id="settings-appearance" title="Appearance">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="min-h-[10rem] flex flex-col">
            <h3 className="font-semibold mb-4">Theme</h3>
            <div className="flex gap-3 mt-auto">
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
          <Card className="min-h-[10rem] flex flex-col">
            <h3 className="font-semibold mb-2">Install app</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4 flex-1">
              Add Mission Control to your home screen for quick access.
            </p>
            <InstallAppButton />
          </Card>
        </div>
      </PageSection>

      <PageSection id="settings-connections" title="Connections">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ConnectedServicesCard />
          <div className="grid grid-cols-1 gap-4">
            <Card className="min-h-[10rem] flex flex-col">
              <h3 className="font-semibold mb-2">API Explorer</h3>
              <p className="text-sm text-[var(--color-muted)] mb-4 flex-1">
                Run live probes against every Mission Control route and inspect JSON responses.
              </p>
              <Link
                to="/dashboard/api-explorer"
                className="inline-flex w-fit items-center px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
              >
                Open API Explorer
              </Link>
            </Card>
            <Card className="min-h-[10rem] flex flex-col">
              <h3 className="font-semibold mb-2">Google Analytics measurement ID</h3>
              <p className="text-sm text-[var(--color-muted)] mb-4">
                Optional client-side slot stored under localStorage key{" "}
                <code className="font-[family-name:var(--font-mono)] text-xs">{GA_KEY}</code>.
              </p>
              <form onSubmit={saveGa} className="flex flex-col sm:flex-row gap-3 mt-auto">
                <input
                  type="text"
                  value={gaId}
                  onChange={(e) => setGaId(e.target.value)}
                  placeholder={gaHasStored ? "•••••••••• (saved — enter to replace)" : "G-XXXXXXXXXX"}
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-[family-name:var(--font-mono)]"
                  aria-label="GA measurement ID"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm border border-[var(--color-border)] hover:bg-white/5 shrink-0"
                >
                  Save locally
                </button>
              </form>
              {gaSaved && (
                <p className="text-xs text-[var(--color-neon)] mt-2">Saved to localStorage (value not echoed).</p>
              )}
              {gaHasStored && !gaSaved && (
                <p className="text-xs text-[var(--color-muted)] mt-2">A measurement ID is stored locally.</p>
              )}
            </Card>
          </div>
        </div>
      </PageSection>

      <PageSection id="settings-environment" title="Environment">
        <Card className="min-h-[14rem]">
          <h3 className="font-semibold mb-4">API health</h3>
          {health ? (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center gap-x-4">
                <dt className="text-[var(--color-muted)]">GitHub API</dt>
                <dd>
                  <Badge variant={health.checks.github ? "synced" : "danger"}>
                    {health.checks.github ? "OK" : "Down"}
                  </Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center gap-x-4">
                <dt className="text-[var(--color-muted)]">GitHub token configured</dt>
                <dd>
                  <Badge variant={health.githubTokenConfigured ? "synced" : "warn"}>
                    {health.githubTokenConfigured ? "true" : "false"}
                  </Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center gap-x-4">
                <dt className="text-[var(--color-muted)]">Admin KV configured</dt>
                <dd>
                  <Badge variant={health.adminKvConfigured ? "synced" : "warn"}>
                    {health.adminKvConfigured ? "true" : "false"}
                  </Badge>
                </dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center gap-x-4">
                <dt className="text-[var(--color-muted)]">Firebase project</dt>
                <dd className="font-[family-name:var(--font-mono)] sm:text-right break-all">{health.firebaseProject}</dd>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center gap-x-4">
                <dt className="text-[var(--color-muted)]">Last check</dt>
                <dd className="sm:text-right">{new Date(health.checks.timestamp).toLocaleString()}</dd>
              </div>
              {health.siteDataUrl && (
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between gap-x-4 md:col-span-2">
                  <dt className="text-[var(--color-muted)] shrink-0">Site data URL</dt>
                  <dd className="font-[family-name:var(--font-mono)] text-xs text-right break-all">
                    {health.siteDataUrl}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">Health check unavailable in this environment.</p>
          )}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-sm text-[var(--color-muted)]">
            <p>
              <strong className="text-[var(--color-text)]">Pages secrets:</strong>{" "}
              <code className="font-[family-name:var(--font-mono)] text-xs">GITHUB_TOKEN</code> and{" "}
              <code className="font-[family-name:var(--font-mono)] text-xs">RESEND_API_KEY</code> stay in Cloudflare
              Pages environment variables — never shown in this UI.
            </p>
          </div>
        </Card>
      </PageSection>
    </div>
  );
}
