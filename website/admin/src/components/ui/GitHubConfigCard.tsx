import { useAuthSession } from "../../lib/use-auth-session";
import { useEffect, useState } from "react";
import { GitBranch, Save } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { fetchGithubConfigApi, putGithubConfigApi, type GithubIntegrationConfig } from "../../lib/api";

export default function GitHubConfigCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<GithubIntegrationConfig | null>(null);
  const [repository, setRepository] = useState("");
  const [secretsEnvironment, setSecretsEnvironment] = useState("admin-production");
  const [githubToken, setGithubToken] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["push", "release", "workflow_run"]);

  useEffect(() => {
    fetchGithubConfigApi()
      .then((data) => {
        setConfig(data.config);
        setRepository(data.config.repository);
        setSecretsEnvironment(data.config.secretsEnvironment);
        setWebhookEvents(data.config.webhookEvents ?? ["push", "release", "workflow_run"]);
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putGithubConfigApi({
        repository: repository.trim(),
        secretsEnvironment: secretsEnvironment.trim(),
        webhookEvents,
        ...(githubToken.trim() ? { githubToken: githubToken.trim() } : {}),
      });
      setConfig(result.config);
      setGithubToken("");
      const syncNote = result.githubSyncWarning
        ? ` ${result.githubSyncWarning}`
        : result.githubSecretsSyncedAt
          ? " GitHub secrets updated."
          : "";
      setMessage({ type: result.githubSyncWarning ? "error" : "success", text: `GitHub settings saved.${syncNote}` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <GitBranch size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            GitHub
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Repository and Actions environment for CI secrets. Mission Control uses <code className="text-xs">GITHUB_TOKEN</code>{" "}
            on Cloudflare Pages to dispatch workflows and sync secrets.
          </p>
        </div>
        {config && (
          <Badge variant={config.tokenConfigured ? "synced" : "warn"}>
            {config.tokenConfigured ? "Token on server" : "No server token"}
          </Badge>
        )}
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading GitHub settings…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="github-repository">
              Repository
            </label>
            <input
              id="github-repository"
              className={inputClass}
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              disabled={!canWrite}
              placeholder="Owner/repo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="github-secrets-env">
              Secrets environment
            </label>
            <input
              id="github-secrets-env"
              className={inputClass}
              value={secretsEnvironment}
              onChange={(e) => setSecretsEnvironment(e.target.value)}
              disabled={!canWrite}
            />
            <FieldHelp label="Secrets environment" className="mt-1">
              GitHub Actions environment name where VITE_FIREBASE_*, CLOUDFLARE_*, and CRON_SECRET are stored.
            </FieldHelp>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="github-token">
              Rotate GITHUB_TOKEN secret
            </label>
            <input
              id="github-token"
              type="password"
              autoComplete="off"
              className={inputClass}
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              disabled={!canWrite}
              placeholder="Leave blank to keep current PAT"
            />
            <FieldHelp label="GITHUB_TOKEN" className="mt-1">
              Needs repo + workflow + secrets scopes. Updates admin-production only when provided.
            </FieldHelp>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
            <h4 className="text-sm font-semibold">Inbound webhooks (GH-06)</h4>
            <p className="text-xs text-[var(--color-muted)]">
              Point your repo webhook at this URL. Events log to Mission Control, post to Discord (community or
              deployment webhook), and publish <strong>release</strong> events to enabled social platforms.
            </p>
            <ol className="text-xs text-[var(--color-muted)] list-decimal list-inside space-y-1">
              <li>Save settings below to generate the webhook secret and URL.</li>
              <li>
                GitHub → repo <strong>Settings → Webhooks → Add webhook</strong> — paste URL, secret, JSON payload.
              </li>
              <li>Enable Pushes, Releases, and Workflow runs (match the checkboxes here).</li>
            </ol>
            {config?.webhookUrl ? (
              <p className="text-xs font-[family-name:var(--font-mono)] break-all">{config.webhookUrl}</p>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">Save settings to generate webhook secret + URL.</p>
            )}
            {config?.webhookSecretPreview ? (
              <p className="text-xs text-[var(--color-muted)]">Secret: {config.webhookSecretPreview}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {(["push", "release", "workflow_run"] as const).map((event) => (
                <label key={event} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={webhookEvents.includes(event)}
                    disabled={!canWrite}
                    onChange={(e) => {
                      setWebhookEvents((prev) =>
                        e.target.checked ? [...prev, event] : prev.filter((x) => x !== event)
                      );
                    }}
                  />
                  {event}
                </label>
              ))}
            </div>
            {config?.recentWebhookEvents && config.recentWebhookEvents.length > 0 ? (
              <ul className="text-xs text-[var(--color-muted)] space-y-1">
                {config.recentWebhookEvents.slice(0, 5).map((evt) => (
                  <li key={`${evt.ts}-${evt.event}`}>
                    {evt.event}: {evt.summary}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {config?.secretsPresent && config.secretsPresent.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--color-muted)] mb-1">Environment secrets present</p>
              <p className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-text)] break-all">
                {config.secretsPresent.join(", ")}
              </p>
            </div>
          )}

          {!canWrite && (
            <p className="text-xs text-[var(--color-muted)]">Only the master admin can edit GitHub settings.</p>
          )}

          {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

          {canWrite && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-bg-base)] font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save GitHub settings"}
            </button>
          )}
        </form>
      )}
    </Card>
  );
}
