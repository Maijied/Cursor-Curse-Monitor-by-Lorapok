import { useCallback, useEffect, useState } from "react";
import { Mail, Save } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { auth } from "../../lib/firebase";
import { useIntervalRefresh } from "../../hooks/useIntervalRefresh";
import {
  fetchSubscribePromptConfigApi,
  putSubscribePromptConfigApi,
  type SubscribePromptConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Configure subscribe modal gating and Discord fallback when outbound mail is unavailable.
 */
export default function SubscribePromptCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<SubscribePromptConfig | null>(null);
  const [form, setForm] = useState({
    subscribeModalEnabled: true,
    requireMailForSubscribe: true,
    subscribeFallbackMode: "discord" as "discord" | "hidden",
    subscribeFallbackDiscordUrl: "https://discord.gg/bp42QAMC6",
  });

  const load = useCallback(() => {
    fetchSubscribePromptConfigApi()
      .then((data) => {
        setConfig(data.config);
        setForm({
          subscribeModalEnabled: data.config.subscribeModalEnabled,
          requireMailForSubscribe: data.config.requireMailForSubscribe,
          subscribeFallbackMode: data.config.subscribeFallbackMode,
          subscribeFallbackDiscordUrl: data.config.subscribeFallbackDiscordUrl,
        });
      })
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
      const result = await putSubscribePromptConfigApi(form);
      setConfig(result.config);
      setMessage({ type: "success", text: "Subscribe prompt settings saved." });
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
            <Mail size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Subscribe prompts
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Gate the marketing-site subscribe modal on working outbound mail. When mail is down, show a
            Discord invite or hide prompts entirely.
          </p>
        </div>
        {config && (
          <Badge variant={config.subscribeModalEnabled ? "synced" : "warn"}>
            {config.subscribeModalEnabled ? "Modal enabled" : "Modal off"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading subscribe settings" className="!flex-row !gap-3" />
          <span>Loading subscribe settings…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.subscribeModalEnabled}
              onChange={(e) => setForm((prev) => ({ ...prev, subscribeModalEnabled: e.target.checked }))}
              disabled={!isMaster}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">Show delayed subscribe modal</span>
              <span className="text-[var(--color-muted)]">
                When off, the marketing site never schedules the popup prompt.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.requireMailForSubscribe}
              onChange={(e) => setForm((prev) => ({ ...prev, requireMailForSubscribe: e.target.checked }))}
              disabled={!isMaster}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">Require working outbound mail</span>
              <span className="text-[var(--color-muted)]">
                Checks Cloudflare Email / Resend transport via <code className="font-[family-name:var(--font-mono)]">GET /api/site-config</code>.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="subscribe-fallback-mode" className="block text-sm font-medium mb-2">
              When mail is unavailable
            </label>
            <select
              id="subscribe-fallback-mode"
              value={form.subscribeFallbackMode}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  subscribeFallbackMode: e.target.value === "hidden" ? "hidden" : "discord",
                }))
              }
              disabled={!isMaster}
              className={inputClass}
            >
              <option value="discord">Show Discord community CTA</option>
              <option value="hidden">Hide subscribe prompts</option>
            </select>
          </div>

          {form.subscribeFallbackMode === "discord" && (
            <div>
              <label htmlFor="subscribe-fallback-discord" className="block text-sm font-medium mb-2">
                Fallback Discord invite URL
              </label>
              <input
                id="subscribe-fallback-discord"
                type="url"
                value={form.subscribeFallbackDiscordUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subscribeFallbackDiscordUrl: e.target.value }))
                }
                disabled={!isMaster}
                placeholder="https://discord.gg/bp42QAMC6"
                className={inputClass}
              />
              <FieldHelp label="Discord fallback" className="mt-2">
                Shown on the marketing site when outbound mail is unavailable. Use a permanent invite link.
              </FieldHelp>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!isMaster || saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save settings"}
            </button>
            {!isMaster && <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>}
          </div>
        </form>
      )}
    </Card>
  );
}
