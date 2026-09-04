import { useAuthSession } from "../../lib/auth-context";
import { useCallback, useEffect, useState } from "react";
import { Clock, PauseCircle, RefreshCw, Save, Send } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import LoadableButton from "./LoadableButton";
import Badge from "./Badge";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { useIntervalRefresh } from "../../hooks/useIntervalRefresh";
import {
  fetchCronJobsConfigApi,
  fetchSyncStatus,
  putCronJobsConfigApi,
  refreshStatsNowApi,
  sendDiscordDigestTestApi,
  type CronJobsConfigResponse,
  type DiscordDigestConfig,
  type StatsRefreshConfig,
} from "../../lib/api";
import { formatDownloadCount } from "../../lib/download-stats";

function formatInterval(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${minutes} min`;
}

/**
 * Unified cron schedules — Cloudflare worker jobs (editable) + GitHub Actions (read-only).
 */
export default function CronSchedulesCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("settings.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [data, setData] = useState<CronJobsConfigResponse | null>(null);

  const [statsEnabled, setStatsEnabled] = useState(false);
  const [statsInterval, setStatsInterval] = useState(5);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestInterval, setDigestInterval] = useState(1440);
  const [digestRefreshFirst, setDigestRefreshFirst] = useState(true);
  const [digestIncludeChangelog, setDigestIncludeChangelog] = useState(true);
  const [kvWarning, setKvWarning] = useState<string | null>(null);
  const [pausingStats, setPausingStats] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchCronJobsConfigApi()
      .then((payload) => {
        setData(payload);
        setStatsEnabled(payload.statsRefresh.enabled);
        setStatsInterval(payload.statsRefresh.intervalMinutes);
        setDigestEnabled(payload.discordDigest.enabled);
        setDigestInterval(payload.discordDigest.intervalMinutes);
        setDigestRefreshFirst(payload.discordDigest.refreshBeforeSend);
        setDigestIncludeChangelog(payload.discordDigest.includeChangelog);
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));

    fetchSyncStatus()
      .then((sync) => {
        if (sync.stats.kvQuotaHit) {
          const pause = sync.stats.writesPausedUntil
            ? ` Writes paused until ${sync.stats.writesPausedUntil} (UTC).`
            : "";
          setKvWarning((sync.hint ?? sync.stats.lastRunError ?? "KV daily limit exceeded.") + pause);
        } else {
          setKvWarning(null);
        }
      })
      .catch(() => setKvWarning(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useIntervalRefresh(load, 60_000);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putCronJobsConfigApi({
        statsRefresh: { enabled: statsEnabled, intervalMinutes: Number(statsInterval) },
        discordDigest: {
          enabled: digestEnabled,
          intervalMinutes: Number(digestInterval),
          refreshBeforeSend: digestRefreshFirst,
          includeChangelog: digestIncludeChangelog,
        },
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              statsRefresh: result.statsRefresh,
              discordDigest: result.discordDigest,
            }
          : prev
      );
      setStatsEnabled(result.statsRefresh.enabled);
      setStatsInterval(result.statsRefresh.intervalMinutes);
      setDigestEnabled(result.discordDigest.enabled);
      setDigestInterval(result.discordDigest.intervalMinutes);
      setDigestRefreshFirst(result.discordDigest.refreshBeforeSend);
      setDigestIncludeChangelog(result.discordDigest.includeChangelog);
      setMessage({ type: "success", text: "Cron schedules saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handlePauseStatsForQuota = async () => {
    if (!canWrite) return;
    setPausingStats(true);
    setMessage(null);
    try {
      await putCronJobsConfigApi({ statsRefresh: { enabled: false } });
      setStatsEnabled(false);
      setMessage({
        type: "success",
        text: "Automatic stats refresh paused. Re-enable when KV quota resets.",
      });
      load();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Pause failed" });
    }
    setPausingStats(false);
  };

  const handleRefreshNow = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const result = await refreshStatsNowApi();
      setMessage({
        type: "success",
        text: `Live stats updated${result.displayTotal != null ? ` — ${formatDownloadCount(result.displayTotal)} verified downloads` : ""}.`,
      });
      load();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Refresh failed" });
    }
    setRefreshing(false);
  };

  const handleSendDigest = async () => {
    setSendingDigest(true);
    setMessage(null);
    try {
      const result = await sendDiscordDigestTestApi();
      setMessage({
        type: "success",
        text: `Discord digest sent${result.displayTotal != null ? ` (${formatDownloadCount(result.displayTotal)} installs)` : ""}.`,
      });
      load();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Digest failed" });
    }
    setSendingDigest(false);
  };

  const renderRunMeta = (config: StatsRefreshConfig | DiscordDigestConfig) => {
    if (!config.lastRunAt) return null;
    return (
      <p className="text-xs text-[var(--color-muted)] mt-2">
        Last run: {new Date(config.lastRunAt).toLocaleString()}
        {config.lastRunOk === false && config.lastError ? ` — ${config.lastError}` : ""}
        {config.lastDurationMs != null ? ` (${config.lastDurationMs} ms)` : ""}
      </p>
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Clock size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Cron schedules
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Cloudflare <code className="text-xs">ccm-stats-cron</code> pings Mission Control every minute.
            Intervals below gate when each job actually runs. GitHub Actions weekly jobs are listed for
            reference — edit their cron in <code className="text-xs">ci-cd.yml</code>.
          </p>
        </div>
      </div>

      {kvWarning ? (
        <div
          className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_40%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-3 text-xs text-[var(--color-muted)]"
          role="alert"
        >
          <p className="font-medium text-[var(--color-danger)] mb-1">KV quota — stats refresh affected</p>
          <p>{kvWarning}</p>
          {canWrite && statsEnabled ? (
            <button
              type="button"
              disabled={pausingStats}
              onClick={handlePauseStatsForQuota}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/5 disabled:opacity-50 text-xs font-medium"
            >
              <PauseCircle size={14} aria-hidden="true" />
              {pausingStats ? "Pausing…" : "Pause automatic stats refresh"}
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <Notification
          tone={message.type === "success" ? "success" : "error"}
          message={message.text}
          className="mb-4"
        />
      ) : null}

      {loading ? (
        <LorapokLarvaeLoader label="Loading cron schedules…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          <section className="space-y-4 rounded-xl border border-[var(--color-border)] p-4 bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-[var(--color-text)]">Live stats refresh</h4>
              <Badge variant={statsEnabled ? "synced" : "warn"}>
                {statsEnabled ? `Every ${statsInterval} min` : "Paused"}
              </Badge>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Polls Open VSX, VS Code Marketplace, GitHub releases, and Firefox AMO; updates KV cache and badges.
            </p>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={statsEnabled}
                onChange={(e) => setStatsEnabled(e.target.checked)}
                disabled={!canWrite}
                className="rounded border-[var(--color-border)]"
              />
              <span>Enable automatic refresh</span>
            </label>
            <div>
              <label className="block text-sm text-[var(--color-muted)] mb-2" htmlFor="statsInterval">
                Interval (minutes, 1–60)
              </label>
              <input
                id="statsInterval"
                type="number"
                min={1}
                max={60}
                step={1}
                value={statsInterval}
                onChange={(e) => setStatsInterval(Number(e.target.value))}
                disabled={!canWrite}
                className={inputClass}
              />
              <FieldHelp label="Stats interval" className="mt-2">
                Each run may write cache, badges, and logs to KV. Use 15+ minutes on Workers Free to avoid daily limits.
              </FieldHelp>
            </div>
            {data ? renderRunMeta(data.statsRefresh) : null}
            <LoadableButton
              type="button"
              onClick={handleRefreshNow}
              loading={refreshing}
              loadingLabel="Refreshing…"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh stats now
            </LoadableButton>
          </section>

          <section className="space-y-4 rounded-xl border border-[color-mix(in_srgb,var(--color-accent)_25%,var(--color-border))] p-4 bg-white/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-[var(--color-text)]">Discord download digest</h4>
              <Badge variant={digestEnabled ? "synced" : "warn"}>
                {digestEnabled ? `Every ${formatInterval(digestInterval)}` : "Paused"}
              </Badge>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Sends download breakdown, marketplace sync, engagement, and changelog to the{" "}
              <strong>deployment</strong> Discord webhook (configure under Deployments).
            </p>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                disabled={!canWrite}
                className="rounded border-[var(--color-border)]"
              />
              <span>Enable scheduled Discord digest</span>
            </label>
            <div>
              <label className="block text-sm text-[var(--color-muted)] mb-2" htmlFor="digestInterval">
                Interval (minutes, 60–10080 — hourly to weekly)
              </label>
              <input
                id="digestInterval"
                type="number"
                min={60}
                max={10080}
                step={60}
                value={digestInterval}
                onChange={(e) => setDigestInterval(Number(e.target.value))}
                disabled={!canWrite}
                className={inputClass}
              />
              <FieldHelp label="Digest interval" className="mt-2">
                Posts to the deployment Discord webhook. Refresh-before-send triggers an extra stats refresh (more KV writes).
              </FieldHelp>
            </div>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={digestRefreshFirst}
                onChange={(e) => setDigestRefreshFirst(e.target.checked)}
                disabled={!canWrite}
                className="rounded border-[var(--color-border)]"
              />
              <span>Refresh live stats before sending</span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={digestIncludeChangelog}
                onChange={(e) => setDigestIncludeChangelog(e.target.checked)}
                disabled={!canWrite}
                className="rounded border-[var(--color-border)]"
              />
              <span>Include latest changelog section</span>
            </label>
            {data ? renderRunMeta(data.discordDigest) : null}
            {canWrite ? (
              <LoadableButton
                type="button"
                onClick={handleSendDigest}
                loading={sendingDigest}
                loadingLabel="Sending…"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] disabled:opacity-50"
              >
                <Send size={16} aria-hidden="true" />
                Send digest now
              </LoadableButton>
            ) : null}
          </section>

          {data?.githubJobs?.length ? (
            <section className="space-y-3">
              <h4 className="font-semibold text-sm text-[var(--color-muted)] uppercase tracking-wide">
                GitHub Actions (read-only)
              </h4>
              <ul className="space-y-2">
                {data.githubJobs.map((job) => (
                  <li
                    key={job.id}
                    className="rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm bg-[var(--color-bg-base)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-[var(--color-text)]">{job.label}</span>
                      <Badge variant="neutral">{job.scheduleLabel}</Badge>
                    </div>
                    <p className="text-[var(--color-muted)] mt-1">{job.description}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-1 font-[family-name:var(--font-mono)]">
                      {job.workflow}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data?.cache?.refreshedAt ? (
            <p className="text-xs text-[var(--color-neon)]">
              Cached live total:{" "}
              {data.cache.displayTotal != null ? formatDownloadCount(data.cache.displayTotal) : "—"} ·{" "}
              {new Date(data.cache.refreshedAt).toLocaleString()}
            </p>
          ) : null}

          {canWrite ? (
            <LoadableButton
              type="submit"
              loading={saving}
              loadingLabel="Saving…"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              Save cron settings
            </LoadableButton>
          ) : null}
        </form>
      )}
    </Card>
  );
}
