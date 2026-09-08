import { useCallback } from "react";
import { usePollingFetch } from "../../hooks/usePollingFetch";
import { useSiteData } from "../../hooks/useSiteData";
import { fetchHealth, fetchSyncStatus, type SyncStatusPayload } from "../../lib/api";
import { resolvePackageVersion, syncStatusLabel } from "../../lib/site-data";
import StatusDot from "../ui/StatusDot";

function serviceDotStatus(
  overall: SyncStatusPayload["overall"] | undefined,
  healthOk: boolean | undefined
): "ok" | "warn" | "danger" {
  if (overall === "online") return "ok";
  if (overall === "degraded") return "warn";
  if (overall === "offline") return "danger";
  if (healthOk === true) return "ok";
  if (healthOk === false) return "danger";
  return "warn";
}

function serviceLabel(
  overall: SyncStatusPayload["overall"] | undefined,
  healthOk: boolean | undefined
): string {
  if (overall === "online") return "Services online";
  if (overall === "degraded") return "Degraded";
  if (overall === "offline") return "Offline";
  if (healthOk === true) return "Services online";
  if (healthOk === false) return "Offline";
  return "Checking…";
}

/**
 * Sticky bottom status bar — services health, release version, marketplace sync, Lorapok Labs.
 */
export default function GlobalFooter() {
  const healthFetcher = useCallback(() => fetchHealth(), []);
  const syncFetcher = useCallback(() => fetchSyncStatus(), []);
  const { data: health } = usePollingFetch(healthFetcher, { intervalMs: 60_000 });
  const { data: sync } = usePollingFetch(syncFetcher, { intervalMs: 60_000 });
  const { data: siteData } = useSiteData({ pollIntervalMs: 60_000 });

  const healthOk = health ? health.ok && health.checks.github : undefined;
  const dotStatus = serviceDotStatus(sync?.overall, healthOk);
  const statusLabel = serviceLabel(sync?.overall, healthOk);
  const version = siteData ? resolvePackageVersion(siteData) : null;
  const marketplaceSync = siteData?.syncStatus ? syncStatusLabel(siteData.syncStatus) : null;

  return (
    <footer
      role="contentinfo"
      aria-label="System status"
      className="shrink-0 z-20 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_92%,transparent)] backdrop-blur-sm px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        <span className="inline-flex items-center gap-1.5" title={sync?.hint ?? statusLabel}>
          <StatusDot status={dotStatus} pulse={dotStatus === "ok"} />
          <span>{statusLabel}</span>
        </span>
        {version ? (
          <>
            <span className="opacity-40 select-none" aria-hidden="true">·</span>
            <span title="Release version from site-data">v{version}</span>
          </>
        ) : null}
        {marketplaceSync ? (
          <>
            <span className="opacity-40 select-none" aria-hidden="true">·</span>
            <span title="Marketplace sync status">{marketplaceSync}</span>
          </>
        ) : null}
      </div>
      <a
        href="https://lorapok.tech"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 hover:text-[var(--color-accent)] transition-colors"
      >
        Lorapok Labs
      </a>
    </footer>
  );
}
