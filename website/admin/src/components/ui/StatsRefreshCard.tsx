import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, Save } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import { auth } from "../../lib/firebase";
import {
  fetchStatsRefreshConfigApi,
  putStatsRefreshConfigApi,
  refreshStatsNowApi,
  type StatsRefreshConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";
import { formatDownloadCount } from "../../lib/download-stats";

/**
 * Configure live download/marketplace stats refresh (cron + manual).
 */
export default function StatsRefreshCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<StatsRefreshConfig | null>(null);
  const [cacheTotal, setCacheTotal] = useState<number | null>(null);
  const [cacheAt, setCacheAt] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(5);

  const load = () => {
    setLoading(true);
    fetchStatsRefreshConfigApi()
      .then((data) => {
        setConfig(data.config);
        setEnabled(data.config.enabled);
        setIntervalMinutes(data.config.intervalMinutes);
        setCacheTotal(data.cache?.displayTotal ?? null);
        setCacheAt(data.cache?.refreshedAt ?? null);
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putStatsRefreshConfigApi({
        enabled,
        intervalMinutes: Number(intervalMinutes),
      });
      setConfig(result.config);
      setMessage({
        type: "success",
        text: `Live stats refresh ${result.config.enabled ? "enabled" : "disabled"} — every ${result.config.intervalMinutes} min when cron is on.`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleRefreshNow = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const result = await refreshStatsNowApi();
      setCacheAt(result.refreshedAt ?? new Date().toISOString());
      setCacheTotal(result.displayTotal ?? null);
      setMessage({
        type: "success",
        text: `Live stats updated${result.displayTotal != null ? ` — ${formatDownloadCount(result.displayTotal)} verified downloads` : ""} (${result.durationMs ?? "—"} ms).`,
      });
      load();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Refresh failed" });
    }
    setRefreshing(false);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Live stats refresh
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Polls Open VSX, VS Code Marketplace, GitHub releases, and Firefox AMO on a schedule you
            choose. Off by default — enable only when you want automatic updates. Manual refresh
            always works. CI deploys the <code className="text-xs">ccm-stats-cron</code> worker and
            syncs <code className="text-xs">CRON_SECRET</code> from cred vault (
            <code className="text-xs">npm run stats:cron:sync-vault --prefix website/admin</code>).
          </p>
        </div>
        {config && (
          <Badge variant={config.enabled ? "synced" : "warn"}>
            {config.enabled ? `Every ${config.intervalMinutes} min` : "Paused"}
          </Badge>
        )}
      </div>

      {message && (
        <Notification type={message.type} className="mb-4">
          {message.text}
        </Notification>
      )}

      {loading ? (
        <LorapokLarvaeLoader label="Loading stats refresh settings…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <label className="flex items-center gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={!isMaster}
              className="rounded border-[var(--color-border)]"
            />
            <span>Enable automatic refresh (cron worker)</span>
          </label>

          <div>
            <label className="block text-sm text-[var(--color-muted)] mb-2" htmlFor="statsInterval">
              Interval (minutes)
            </label>
            <input
              id="statsInterval"
              type="number"
              min={1}
              max={60}
              step={1}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              disabled={!isMaster}
              className={inputClass}
            />
          </div>

          {config?.lastRunAt && (
            <p className="text-xs text-[var(--color-muted)]">
              Last run: {new Date(config.lastRunAt).toLocaleString()}
              {config.lastRunOk === false && config.lastError ? ` — ${config.lastError}` : ""}
              {config.lastDurationMs != null ? ` (${config.lastDurationMs} ms)` : ""}
            </p>
          )}
          {cacheAt && (
            <p className="text-xs text-[var(--color-neon)]">
              Cached live total: {cacheTotal != null ? formatDownloadCount(cacheTotal) : "—"} ·{" "}
              {new Date(cacheAt).toLocaleString()}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {isMaster && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving…" : "Save settings"}
              </button>
            )}
            <button
              type="button"
              onClick={handleRefreshNow}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
