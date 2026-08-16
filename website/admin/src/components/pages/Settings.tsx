import { useEffect, useState, type FormEvent } from "react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
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
    <div className="space-y-8 animate-fade-slide-up max-w-2xl">
      <PageHeader title="Settings" description="Appearance, connections, and environment." />

      <section aria-labelledby="settings-appearance">
        <h2 id="settings-appearance" className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
          Appearance
        </h2>
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
      </section>

      <section aria-labelledby="settings-connections">
        <h2 id="settings-connections" className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
          Connections
        </h2>
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold mb-2">Install app</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Add Mission Control to your home screen for quick access.
            </p>
            <InstallAppButton />
          </Card>
          <ConnectedServicesCard />
          <Card>
            <h3 className="font-semibold mb-2">Google Analytics measurement ID</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Optional client-side slot stored under localStorage key{" "}
              <code className="font-[family-name:var(--font-mono)] text-xs">{GA_KEY}</code>. Never sent to the server;
              the saved value is not echoed back into this field.
            </p>
            <form onSubmit={saveGa} className="flex flex-col sm:flex-row gap-3">
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
                className="px-4 py-2 rounded-xl text-sm border border-[var(--color-border)] hover:bg-white/5"
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
      </section>

      <section aria-labelledby="settings-environment">
        <h2 id="settings-environment" className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">
          Environment
        </h2>
        <Card>
          <h3 className="font-semibold mb-4">API health</h3>
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
              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-muted)]">GitHub token configured</dt>
                <dd>
                  <Badge variant={health.githubTokenConfigured ? "synced" : "warn"}>
                    {health.githubTokenConfigured ? "true" : "false"}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-muted)]">Admin KV configured</dt>
                <dd>
                  <Badge variant={health.adminKvConfigured ? "synced" : "warn"}>
                    {health.adminKvConfigured ? "true" : "false"}
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
              {health.siteDataUrl && (
                <div className="flex justify-between gap-4">
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
          <div className="mt-6 pt-4 border-t border-[var(--color-border)] text-sm text-[var(--color-muted)] space-y-2">
            <p>
              <strong className="text-[var(--color-text)]">Pages secrets:</strong>{" "}
              <code className="font-[family-name:var(--font-mono)] text-xs">GITHUB_TOKEN</code> and{" "}
              <code className="font-[family-name:var(--font-mono)] text-xs">RESEND_API_KEY</code> (and related mail secrets)
              stay in Cloudflare Pages environment variables — they are never shown in this UI.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
