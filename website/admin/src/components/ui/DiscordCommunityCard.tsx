import { useEffect, useState } from "react";
import { Copy, ExternalLink, MessageCircle, Save, Send } from "lucide-react";
import { DISCORD_INVITE_URL } from "@lorapok/cursor-monitor-shared";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import { auth } from "../../lib/firebase";
import {
  fetchDiscordConfigApi,
  notifyDiscordCommunityApi,
  putDiscordConfigApi,
  type DiscordConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Lorapok Labs Family — public invite link and outbound announcement webhook.
 */
export default function DiscordCommunityCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [inviteUrl, setInviteUrl] = useState(DISCORD_INVITE_URL);

  useEffect(() => {
    fetchDiscordConfigApi()
      .then((data) => {
        setConfig(data.config);
        setInviteUrl(data.config.communityInviteUrl || DISCORD_INVITE_URL);
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const activeInvite = inviteUrl || config?.communityInviteUrl || DISCORD_INVITE_URL;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(activeInvite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ type: "error", text: "Could not copy invite link." });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload: { communityWebhookUrl?: string; communityInviteUrl?: string } = {
        communityInviteUrl: inviteUrl.trim(),
      };
      if (webhookUrl.trim()) payload.communityWebhookUrl = webhookUrl.trim();
      const result = await putDiscordConfigApi(payload);
      setConfig(result.config);
      setInviteUrl(result.config.communityInviteUrl);
      setWebhookUrl("");
      setMessage({ type: "success", text: "Lorapok Labs Family settings saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!isMaster || !config?.communityConfigured) return;
    setTesting(true);
    setMessage(null);
    try {
      const result = await notifyDiscordCommunityApi();
      if (result.skipped) {
        setMessage({ type: "error", text: "Test skipped — save a community webhook URL first." });
      } else {
        setMessage({ type: "success", text: "Sample post sent to Lorapok Labs Family channel." });
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
            <MessageCircle size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Lorapok Labs Family hook
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Public invite for the Lorapok Labs Family Discord plus an optional outbound webhook for
            community announcements. Marketing site and subscribe fallback read the invite from here.
          </p>
        </div>
        {config && (
          <Badge variant={config.communityConfigured ? "synced" : "warn"}>
            {config.communityConfigured ? "Webhook connected" : "Webhook not set"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading Lorapok Labs Family settings" className="!flex-row !gap-3" />
          <span>Loading Lorapok Labs Family settings…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label htmlFor="discord-family-invite" className="block text-sm font-medium mb-2">
              Community invite URL
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="discord-family-invite"
                type="url"
                value={inviteUrl}
                onChange={(e) => setInviteUrl(e.target.value)}
                disabled={!isMaster}
                placeholder={DISCORD_INVITE_URL}
                className={`${inputClass} flex-1 min-w-[16rem]`}
              />
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5"
              >
                <Copy size={16} aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={activeInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5"
              >
                <ExternalLink size={16} aria-hidden="true" />
                Open
              </a>
            </div>
          </div>

          <div>
            <label htmlFor="discord-family-webhook" className="block text-sm font-medium mb-2">
              Announcement webhook URL
            </label>
            <input
              id="discord-family-webhook"
              type="password"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              disabled={!isMaster}
              placeholder={
                config?.communityWebhookPreview
                  ? `Saved: ${config.communityWebhookPreview}`
                  : "https://discord.com/api/webhooks/…"
              }
              className={inputClass}
              autoComplete="off"
            />
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Sync from cred vault with{" "}
              <code className="font-[family-name:var(--font-mono)]">node scripts/sync-discord-cred-vault.mjs</code>{" "}
              or paste once here. Never commit webhook URLs to git.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              disabled={!isMaster || testing || !config?.communityConfigured}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              {testing ? "Sending…" : "Send test post"}
            </button>
          </div>

          {!isMaster && <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>}
        </form>
      )}
    </Card>
  );
}
