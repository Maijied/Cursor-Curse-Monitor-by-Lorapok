import { useAuthSession } from "../../lib/use-auth-session";
import { useCallback, useEffect, useState } from "react";
import { GitBranch, Save, Send } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { useIntervalRefresh } from "../../hooks/useIntervalRefresh";
import {
  fetchDiscordConfigApi,
  notifyDiscordGithubLogApi,
  putDiscordConfigApi,
  type DiscordConfig,
} from "../../lib/api";

/**
 * Configures the Discord webhook for GitHub ingest (push / release / completed workflows).
 * Separate from deployment cards and community announcements.
 */
export default function DiscordGithubLogCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchDiscordConfigApi()
      .then((data) => setConfig(data.config))
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useIntervalRefresh(load, 60_000);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putDiscordConfigApi({ githubLogWebhookUrl: webhookUrl.trim() });
      setConfig(result.config);
      setWebhookUrl("");
      setMessage({
        type: "success",
        text: "GitHub log hook saved. Push, release, and completed workflows post here — not to community or deployment.",
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!canWrite || !config?.githubLogConfigured) return;
    setTesting(true);
    setMessage(null);
    try {
      const result = await notifyDiscordGithubLogApi();
      if (result.skipped) {
        setMessage({ type: "error", text: "Test skipped — save a github-log webhook URL first." });
      } else {
        setMessage({
          type: "success",
          text: result.summary
            ? `Sample github-log card sent: ${result.summary}`
            : "Sample github-log card sent to Discord.",
        });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test notification failed" });
    }
    setTesting(false);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <GitBranch size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Discord github-log hook
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Repo webhook ingest (push, release, completed workflows) → this channel only.
            Intermediate <code className="text-xs">in_progress</code> runs are filtered.
            Deployment cards stay on the deployment hook; community stays for announcements.
          </p>
        </div>
        {config && (
          <Badge variant={config.githubLogConfigured ? "synced" : "warn"}>
            {config.githubLogConfigured ? "Hook connected" : "Not set"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading github-log configuration" className="!flex-row !gap-3" />
          <span>Loading github-log hook…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="discord-github-log-webhook" className="block text-sm font-medium mb-2">
              Webhook URL
            </label>
            <input
              id="discord-github-log-webhook"
              type="password"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={!canWrite}
              placeholder={
                config?.githubLogWebhookPreview
                  ? `Saved: ${config.githubLogWebhookPreview}`
                  : "https://discord.com/api/webhooks/…"
              }
              className={inputClass}
              autoComplete="off"
            />
            <FieldHelp label="GitHub log webhook" className="mt-2">
              Create in Discord → #github-log (or similar) → Integrations → Webhooks. Vault key:{" "}
              <code className="text-xs">discord_github_log_webhook_url</code>. Sync with{" "}
              <code className="text-xs">node scripts/sync-discord-cred-vault.mjs</code>.
            </FieldHelp>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canWrite || saving || !webhookUrl.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save hook"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={!canWrite || testing || !config?.githubLogConfigured}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              {testing ? "Sending…" : "Send test log"}
            </button>
          </div>

          {!canWrite && (
            <p className="text-xs text-[var(--color-warn)]">Requires integrations.write permission.</p>
          )}
        </form>
      )}
    </Card>
  );
}
