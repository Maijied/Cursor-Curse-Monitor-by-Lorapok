import { useEffect, useState } from "react";
import { Bell, Save } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import Notification from "./Notification";
import { auth } from "../../lib/firebase";
import { fetchDiscordConfigApi, putDiscordConfigApi, type DiscordConfig } from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Displays the Discord webhook configuration and allows master admins to update it.
 */
export default function DiscordIntegrationsCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putDiscordConfigApi({ webhookUrl: webhookUrl.trim() });
      setConfig(result.config);
      setWebhookUrl("");
      setMessage({ type: "success", text: "Discord webhook saved." });
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
            <Bell size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Discord
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Paste your channel webhook URL to get deployment updates in Discord.
          </p>
        </div>
        {config && (
          <Badge variant={config.configured ? "synced" : "neutral"}>
            {config.configured ? "Connected" : "Not set"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
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
              placeholder={config?.webhookPreview ? `Saved: ${config.webhookPreview}` : "https://discord.com/api/webhooks/…"}
              className={inputClass}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={!isMaster || saving || !webhookUrl.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
          >
            <Save size={16} aria-hidden="true" />
            {saving ? "Saving…" : "Save"}
          </button>

          {!isMaster && (
            <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>
          )}
        </form>
      )}
    </Card>
  );
}
