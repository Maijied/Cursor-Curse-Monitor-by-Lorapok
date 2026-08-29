import { useEffect, useState } from "react";
import { MessageSquare, Save, Send } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import { auth } from "../../lib/firebase";
import {
  fetchDiscordConfigApi,
  notifyDiscordFeedbackApi,
  putDiscordConfigApi,
  type DiscordConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Configure the Discord webhook that receives user-facing feedback prompts (separate from deployment status).
 */
export default function DiscordFeedbackCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    fetchDiscordConfigApi()
      .then((data) => setConfig(data.config))
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putDiscordConfigApi({ feedbackWebhookUrl: webhookUrl.trim() });
      setConfig(result.config);
      setWebhookUrl("");
      setMessage({ type: "success", text: "Feedback Discord hook saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!isMaster || !config?.feedbackConfigured) return;
    setTesting(true);
    setMessage(null);
    try {
      const result = await notifyDiscordFeedbackApi();
      if (result.skipped) {
        setMessage({ type: "error", text: "Test skipped — save a feedback webhook URL first." });
      } else {
        setMessage({ type: "success", text: "Sample feedback card sent to Discord." });
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
            <MessageSquare size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Discord feedback hook
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Optional channel for user-feedback prompts (GitHub Issues, Discussions, support links). This is{" "}
            <strong className="text-[var(--color-text)]">not</strong> the deployment status webhook — configure that
            on the Deployments page.
          </p>
        </div>
        {config && (
          <Badge variant={config.feedbackConfigured ? "synced" : "warn"}>
            {config.feedbackConfigured ? "Hook connected" : "Not set"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading Discord configuration" className="!flex-row !gap-3" />
          <span>Loading feedback hook…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="discord-feedback-webhook" className="block text-sm font-medium mb-2">
              Feedback webhook URL
            </label>
            <input
              id="discord-feedback-webhook"
              type="password"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={!isMaster}
              placeholder={
                config?.feedbackWebhookPreview
                  ? `Saved: ${config.feedbackWebhookPreview}`
                  : "https://discord.com/api/webhooks/…"
              }
              className={inputClass}
              autoComplete="off"
            />
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
              disabled={!isMaster || testing || !config?.feedbackConfigured}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              {testing ? "Sending…" : "Send test card"}
            </button>
          </div>

          {!isMaster && <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>}
        </form>
      )}
    </Card>
  );
}
