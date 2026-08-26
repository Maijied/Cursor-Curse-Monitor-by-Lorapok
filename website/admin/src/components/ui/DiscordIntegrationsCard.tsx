import { useEffect, useState } from "react";
import { Bell, ExternalLink, Save, Send } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import Notification from "./Notification";
import { auth } from "../../lib/firebase";
import { fetchDiscordConfigApi, putDiscordConfigApi, testDiscordWebhookApi, type DiscordConfig } from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

const EVENT_LABELS: Array<{ key: keyof DiscordConfig["events"]; label: string; hint: string }> = [
  { key: "started", label: "Deployment started", hint: "When Mission Control triggers a workflow" },
  { key: "completed", label: "Deployment succeeded", hint: "When CI finishes successfully" },
  { key: "failed", label: "Deployment failed", hint: "When CI fails or is cancelled" },
  { key: "pushed", label: "Push to main", hint: "Automatic tag prep on main branch pushes" },
];

export default function DiscordIntegrationsCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<DiscordConfig["events"]>({
    started: true,
    completed: true,
    failed: true,
    pushed: true,
  });

  useEffect(() => {
    fetchDiscordConfigApi()
      .then((data) => {
        setConfig(data.config);
        setEnabled(data.config.enabled);
        setEvents(data.config.events);
        setWebhookUrl("");
      })
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
      const payload: Parameters<typeof putDiscordConfigApi>[0] = { enabled, events };
      if (webhookUrl.trim()) payload.webhookUrl = webhookUrl.trim();
      const result = await putDiscordConfigApi(payload);
      setConfig(result.config);
      setWebhookUrl("");
      setMessage({ type: "success", text: "Discord settings saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!isMaster) return;
    setTesting(true);
    setMessage(null);
    try {
      const result = await testDiscordWebhookApi();
      setMessage({ type: "success", text: result.message });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Test failed" });
    }
    setTesting(false);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Bell size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Discord deployment webhooks
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Rich embeds for deploy starts, CI completions, and push-to-main updates.
          </p>
        </div>
        {config && (
          <Badge variant={config.configured && config.enabled ? "synced" : config.configured ? "warn" : "neutral"}>
            {config.configured ? (config.enabled ? "Active" : "Configured · off") : "Not configured"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading Discord settings…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={!isMaster}
              className="rounded border-[var(--color-border)]"
            />
            <span>Enable Discord notifications</span>
          </label>

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
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Create a webhook in your Discord server channel settings. Leave blank to keep the saved URL.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium mb-1">Notify on</legend>
            {EVENT_LABELS.map(({ key, label, hint }) => (
              <label key={key} className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={events[key]}
                  onChange={(e) => setEvents((prev) => ({ ...prev, [key]: e.target.checked }))}
                  disabled={!isMaster}
                  className="mt-1 rounded border-[var(--color-border)]"
                />
                <span>
                  <span className="text-[var(--color-text)]">{label}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {config?.updatedAt && (
            <p className="text-xs text-[var(--color-muted)]">
              Last saved {new Date(config.updatedAt).toLocaleString()}
              {config.updatedBy ? ` by ${config.updatedBy}` : ""}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!isMaster || saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={!isMaster || testing || !config?.configured}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/5 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              {testing ? "Sending…" : "Send test message"}
            </button>
            <a
              href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-[var(--color-accent-2)] hover:underline"
            >
              Discord webhook docs <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>

          {!isMaster && (
            <p className="text-xs text-[var(--color-warn)]">Master admin access is required to change Discord settings.</p>
          )}
        </form>
      )}
    </Card>
  );
}
