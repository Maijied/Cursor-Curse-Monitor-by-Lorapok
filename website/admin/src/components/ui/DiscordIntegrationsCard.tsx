import { useCallback, useEffect, useState } from "react";
import { Bell, Save, Send } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { auth } from "../../lib/firebase";
import { useIntervalRefresh } from "../../hooks/useIntervalRefresh";
import {
  fetchDiscordConfigApi,
  notifyDiscordDeploymentApi,
  putDiscordConfigApi,
  type DiscordConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Configures and tests the Discord webhook used for deployment status updates.
 *
 * @returns The Discord integration configuration card.
 */
export default function DiscordIntegrationsCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
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
    if (!isMaster) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putDiscordConfigApi({ deploymentWebhookUrl: webhookUrl.trim() });
      setConfig(result.config);
      setWebhookUrl("");
      setMessage({ type: "success", text: "Discord deployment hook saved. Status posts will go to this channel." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!isMaster || !config?.deploymentConfigured) return;
    setTesting(true);
    setMessage(null);
    try {
      const result = await notifyDiscordDeploymentApi({
        actionType: "deployment-status-test",
        tag: "v1.0.31",
        channel: "Production",
        market: "Open VSX · VS Code · GitHub",
        conclusion: "success",
        jobs: [
          { name: "Build & Validate", conclusion: "success" },
          { name: "Deploy Admin Panel", conclusion: "success" },
          { name: "Deploy Marketing Website", conclusion: "success" },
        ],
        summary: "Sample rich deployment card — marketplace sync, downloads, changelog, and links.",
      });
      if (result.skipped) {
        setMessage({ type: "error", text: "Test skipped — save a webhook URL first." });
      } else {
        setMessage({ type: "success", text: "Test deployment status sent to Discord." });
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
            <Bell size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Discord deployment hook
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Channel webhook for deploy, rollback, and infra pipeline status. Mission Control posts
            <strong className="text-[var(--color-text)]"> one compact card per run</strong> when the workflow
            finishes (pipeline, marketplace sync, downloads, changelog, and links).
          </p>
        </div>
        {config && (
          <Badge variant={config.deploymentConfigured ? "synced" : "warn"}>
            {config.deploymentConfigured ? "Hook connected" : "Not set"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading Discord configuration" className="!flex-row !gap-3" />
          <span>Loading Discord hook…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="discord-webhook" className="block text-sm font-medium mb-2">
              Webhook URL
            </label>
            <input
              id="discord-webhook"
              type="password"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={!isMaster}
              placeholder={config?.deploymentWebhookPreview ? `Saved: ${config.deploymentWebhookPreview}` : "https://discord.com/api/webhooks/…"}
              className={inputClass}
              autoComplete="off"
            />
            <FieldHelp label="Deployment webhook" className="mt-2">
              Create in Discord → Channel settings → Integrations → Webhooks. Used for deploy status and download digests.
            </FieldHelp>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!isMaster || saving || !webhookUrl.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save hook"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={!isMaster || testing || !config?.deploymentConfigured}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              {testing ? "Sending…" : "Send test status"}
            </button>
          </div>

          {!isMaster && (
            <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>
          )}
        </form>
      )}
    </Card>
  );
}
