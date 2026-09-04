import { Database, ExternalLink, RefreshCw } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import { usePollingFetch } from "../../hooks/usePollingFetch";
import { fetchSyncStatus } from "../../lib/api";
import { formatDownloadCount } from "../../lib/download-stats";

const CF_KV_LIMITS_URL = "https://developers.cloudflare.com/kv/platform/limits/";

export default function InfrastructureStatusCard() {
  const { data: sync, loading, refresh } = usePollingFetch(fetchSyncStatus, { intervalMs: 30_000 });

  const overallVariant =
    sync?.overall === "online" ? "synced" : sync?.overall === "degraded" ? "warn" : "danger";

  return (
    <Card className="border-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-border))]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-[var(--color-text)]">
            <Database size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Infrastructure &amp; KV
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Live sync health from Mission Control. KV quotas are enforced by Cloudflare — not shown as a
            percentage in-app.
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

      {loading && !sync ? (
        <LorapokLarvaeLoader label="Checking infrastructure…" />
      ) : sync ? (
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 items-center">
            <dt className="text-[var(--color-muted)]">Admin KV</dt>
            <dd>
              <Badge variant={sync.adminKv.configured ? "synced" : "warn"}>
                {sync.adminKv.configured ? "Bound" : "Missing"}
              </Badge>
            </dd>
          </div>
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
          <div className="flex justify-between gap-4 items-center">
            <dt className="text-[var(--color-muted)]">Stats refresh cron</dt>
            <dd>
              <Badge variant={sync.stats.enabled ? "synced" : "warn"}>
                {sync.stats.enabled ? `Every ${sync.stats.intervalMinutes} min` : "Paused"}
              </Badge>
            </dd>
          </div>
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
              <p className="text-[var(--color-muted)] leading-relaxed">
                {sync.hint ?? sync.stats.lastRunError ?? "KV daily limit exceeded."} Pause stats refresh
                under <strong className="text-[var(--color-text)]">Automation</strong> until UTC reset.
              </p>
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
