import { useEffect, useState } from "react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { fetchHealth } from "../../lib/api";

export default function Settings() {
  const [health, setHealth] = useState<
    (Awaited<ReturnType<typeof fetchHealth>> & {
      githubTokenConfigured?: boolean;
      adminKvConfigured?: boolean;
      siteDataUrl?: string;
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

  return (
    <div className="space-y-8 animate-fade-slide-up max-w-2xl">
      <PageHeader title="Settings" description="Theme, API health, and environment info." />

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
        <h3 className="font-semibold mb-4">API Health</h3>
        {health ? (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-[var(--color-muted)]">GitHub API</dt>
              <dd><Badge variant={health.checks.github ? "synced" : "danger"}>{health.checks.github ? "OK" : "Down"}</Badge></dd>
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
                <dd><Badge variant={health.githubTokenConfigured ? "synced" : "warn"}>{health.githubTokenConfigured ? "Configured" : "Missing"}</Badge></dd>
              </div>
            )}
            {health.adminKvConfigured != null && (
              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-muted)]">Admin KV (team sync)</dt>
                <dd><Badge variant={health.adminKvConfigured ? "synced" : "warn"}>{health.adminKvConfigured ? "Configured" : "Use ADMIN_EMAILS"}</Badge></dd>
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
    </div>
  );
}
