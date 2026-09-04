import { useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { usePollingFetch } from "../../hooks/usePollingFetch";
import { fetchSyncStatus, type SyncStatusPayload } from "../../lib/api";
import StatusDot from "./StatusDot";
import Badge from "./Badge";

function overallLabel(overall: SyncStatusPayload["overall"]) {
  if (overall === "online") return "All systems operational";
  if (overall === "degraded") return "Degraded — check Settings";
  return "Offline";
}

function overallDot(overall: SyncStatusPayload["overall"]) {
  if (overall === "online") return "ok" as const;
  if (overall === "degraded") return "warn" as const;
  return "danger" as const;
}

export default function SyncStatusChip({ compact }: { compact?: boolean }) {
  const fetcher = useCallback(() => fetchSyncStatus(), []);
  const { data, loading, refresh } = usePollingFetch(fetcher, { intervalMs: 60_000 });

  if (!data && loading) return null;

  const overall = data?.overall ?? "offline";
  const statsFresh = data?.stats.cache.fresh ?? false;
  const kvHit = data?.stats.kvQuotaHit ?? false;

  return (
    <button
      type="button"
      onClick={() => refresh()}
      className={`inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 min-h-9 hover:bg-white/5 transition-colors ${
        compact ? "text-xs" : "text-sm"
      }`}
      title={data?.hint ?? overallLabel(overall)}
      aria-label={`Sync status: ${overallLabel(overall)}. Click to refresh.`}
    >
      <StatusDot status={overallDot(overall)} pulse={overall === "online"} />
      {!compact && <span className="text-[var(--color-muted)]">{overallLabel(overall)}</span>}
      {data && !compact && (
        <Badge variant={statsFresh ? "synced" : kvHit ? "danger" : "warn"} className="!text-[10px]">
          {kvHit ? "KV limit" : statsFresh ? "Stats live" : "Stats stale"}
        </Badge>
      )}
      <RefreshCw size={12} className="text-[var(--color-muted)] opacity-70" aria-hidden="true" />
    </button>
  );
}
