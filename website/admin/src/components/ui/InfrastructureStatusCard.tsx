import { useAuthSession } from "../../lib/auth-context";
import { useState } from "react";
import { Database, ExternalLink, PauseCircle, RefreshCw } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import { usePollingFetch } from "../../hooks/usePollingFetch";
import { fetchSyncStatus, putCronJobsConfigApi } from "../../lib/api";
import { formatDownloadCount } from "../../lib/download-stats";

const CF_KV_LIMITS_URL = "https://developers.cloudflare.com/kv/platform/limits/";

/** Rough KV put budget per successful stats refresh (see stats-refresh.js). */
const KV_PUTS_UNCHANGED = "1";
const KV_PUTS_CHANGED = "3–5";

export default function InfrastructureStatusCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("settings.write");
  const { data: sync, loading, refresh } = usePollingFetch(fetchSyncStatus, { intervalMs: 30_000 });
  const [pausing, setPausing] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const overallVariant =
    sync?.overall === "online" ? "synced" : sync?.overall === "degraded" ? "warn" : "danger";

  const writesPausedActive = Boolean(
    sync?.stats.writesPausedUntil && Date.parse(sync.stats.writesPausedUntil) > Date.now()
  );

  const handlePauseStats = async () => {
    if (!canWrite) return;
    setPausing(true);
    setNotice(null);
    try {
      await putCronJobsConfigApi({ statsRefresh: { enabled: false } });
      setNotice({ tone: "success", message: "Automatic stats refresh paused. Re-enable under Automation when KV quota resets." });
      refresh();
    } catch (err: unknown) {
      setNotice({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to pause stats refresh",
      });
    } finally {
      setPausing(false);
    }
  };

  return (
    <Card className="border-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-border))]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-[var(--color-text)]">
            <Database size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Infrastructure &amp; KV
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Live sync health from Mission Control. KV daily quotas are enforced by Cloudflare — usage
            percentage is not exposed in-app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sync ? <Badge variant={overallVariant}>{sync.overall}</Badge> : null}
          <button
            type="button"
            onClick={() => refresh()}
            className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors"
            aria-label="Refresh infrastructure status"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {notice ? <Notification tone={notice.tone} message={notice.message} /> : null}

      {loading && !sync ? (
        <LorapokLarvaeLoader label="Checking infrastructure…" />
      ) : sync ? (
        <dl className="space-y-3 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 text-xs text-[var(--color-muted)] space-y-1">
            <p className="font-medium text-[var(--color-text)]">KV write budget (estimate)</p>
            <p>
              Each stats refresh uses about <strong className="text-[var(--color-text)]">{KV_PUTS_CHANGED}</strong>{" "}
              KV <code className="text-[10px]">put()</code> calls when download totals change, or{" "}
              <strong className="text-[var(--color-text)]">{KV_PUTS_UNCHANGED}</strong> when data is unchanged
              (metadata only).
            </p>
            <p>
              Workers Free tier: ~1,000 KV writes/day. Pause automatic refresh when limits are hit.
            </p>
          </div>

          <div className="flex justify-between gap-4 items-center">
            <dt className="text-[var(--color-muted)]">Admin KV</dt>
            <dd>
              <Badge variant={sync.adminKv.configured ? "synced" : "warn"}>
                {sync.adminKv.configured ? "Bound" : "Missing"}
              </Badge>
            </dd>
          </div>
          {sync.adminD1 ? (
            <div className="flex justify-between gap-4 items-start">
              <dt className="text-[var(--color-muted)]">Admin D1</dt>
              <dd className="text-right max-w-[65%]">
                <Badge
                  variant={
                    !sync.adminD1.configured ? "warn" : sync.adminD1.ok ? "synced" : "danger"
                  }
                >
                  {!sync.adminD1.configured
                    ? "Not bound"
                    : sync.adminD1.ok
                      ? "Connected"
                      : "Error"}
                </Badge>
                {sync.adminD1.configured ? (
                  <span className="block text-[10px] text-[var(--color-muted)] mt-0.5">
                    {sync.adminD1.ok
                      ? "ccm-admin-d1 · Phase 2 logs/subscribers"
                      : sync.adminD1.error ?? "Probe failed"}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 items-center">
            <dt className="text-[var(--color-muted)]">Stats cache</dt>
            <dd className="text-right">
              <Badge variant={sync.stats.cache.fresh ? "synced" : "warn"}>
                {sync.stats.cache.fresh ? "Fresh" : "Stale"}
              </Badge>
              {sync.stats.cache.refreshedAt ? (
                <span className="block text-[10px] text-[var(--color-muted)] mt-0.5">
                  {new Date(sync.stats.cache.refreshedAt).toLocaleString()}
                  {sync.stats.cache.displayTotal != null
                    ? ` · ${formatDownloadCount(sync.stats.cache.displayTotal)}`
                    : ""}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between gap-4 items-start">
            <dt className="text-[var(--color-muted)]">Last stats refresh</dt>
            <dd className="text-right max-w-[65%]">
              {sync.stats.lastRunAt ? (
                <>
                  <Badge variant={sync.stats.lastRunOk ? "synced" : "warn"}>
                    {sync.stats.lastRunOk ? "OK" : "Failed"}
                  </Badge>
                  <span className="block text-[10px] text-[var(--color-muted)] mt-0.5">
                    {new Date(sync.stats.lastRunAt).toLocaleString()}
                  </span>
                  {sync.stats.lastRunError ? (
                    <span className="block text-[10px] text-[var(--color-warn)] mt-0.5 line-clamp-3">
                      {sync.stats.lastRunError}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-[var(--color-muted)] text-xs">No run recorded yet</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4 items-center">
            <dt className="text-[var(--color-muted)]">Stats refresh cron</dt>
            <dd>
              <Badge variant={sync.stats.enabled ? "synced" : "warn"}>
                {sync.stats.enabled ? `Every ${sync.stats.intervalMinutes} min` : "Paused"}
              </Badge>
            </dd>
          </div>
          {writesPausedActive && sync.stats.writesPausedUntil ? (
            <div
              className="rounded-xl border border-[color-mix(in_srgb,var(--color-warn)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warn)_8%,transparent)] p-3 text-xs"
              role="status"
            >
              <p className="font-medium text-[var(--color-warn)] mb-1">KV writes auto-paused</p>
              <p className="text-[var(--color-muted)]">
                Skipping refresh until {new Date(sync.stats.writesPausedUntil).toLocaleString()} (UTC reset
                window).
              </p>
            </div>
          ) : null}
          {sync.stats.kvQuotaHit ? (
            <div
              className="rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_40%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-3 text-xs text-[var(--color-text)]"
              role="alert"
            >
              <p className="font-medium text-[var(--color-danger)] mb-1">
                KV quota limit
                {sync.stats.kvQuotaLimitKind === "read"
                  ? " (reads)"
                  : sync.stats.kvQuotaLimitKind === "write"
                    ? " (writes)"
                    : ""}
              </p>
              <p className="text-[var(--color-muted)] leading-relaxed mb-3">
                {sync.hint ?? sync.stats.lastRunError ?? "KV daily limit exceeded."}
              </p>
              {canWrite && sync.stats.enabled ? (
                <button
                  type="button"
                  disabled={pausing}
                  onClick={handlePauseStats}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/5 disabled:opacity-50 text-xs font-medium"
                >
                  <PauseCircle size={14} aria-hidden="true" />
                  {pausing ? "Pausing…" : "Pause automatic stats refresh"}
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-[var(--color-muted)] pt-1">
            <a
              href={CF_KV_LIMITS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              Cloudflare KV limits <ExternalLink size={12} aria-hidden="true" />
            </a>
            {" · "}Last checked {new Date(sync.checkedAt).toLocaleTimeString()}
          </p>
        </dl>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">Infrastructure status unavailable.</p>
      )}
    </Card>
  );
}
