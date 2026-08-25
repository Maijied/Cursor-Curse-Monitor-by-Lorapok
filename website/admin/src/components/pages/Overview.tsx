import { Activity, Download, Package, Store, Users } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import KpiCard from "../ui/KpiCard";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import StatusDot from "../ui/StatusDot";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import DriftAlert from "../ui/DriftAlert";
import DownloadBreakdownPanel from "../ui/DownloadBreakdown";
import SyncRadar from "../ui/SyncRadar";
import VisitorStatsPanel from "../ui/VisitorStatsPanel";
import TrafficTrendGraph from "../ui/TrafficTrendGraph";
import MarketplaceDistributionChart from "../ui/MarketplaceDistributionChart";
import ConnectedServicesCard from "../ui/ConnectedServicesCard";
import { useSiteData } from "../../hooks/useSiteData";
import { useVisitorStats } from "../../hooks/useVisitorStats";
import { useUsageStats } from "../../hooks/useUsageStats";
import { syncStatusLabel, formatCount } from "../../lib/site-data";

function syncBadgeVariant(status: string): "synced" | "drift" | "warn" | "danger" | "neutral" {
  if (status === "synced") return "synced";
  if (status === "drift" || status === "duplicate-listing" || status === "dual-listing") return "warn";
  if (status === "missing") return "danger";
  return "neutral";
}

/**
 * Renders the Mission Control dashboard with synchronization status, marketplace metrics, visitor statistics, and service information.
 */
export default function Overview() {
  const { data, error, loading } = useSiteData();
  const { stats: visitors, live: visitorsLive } = useVisitorStats(data?.visitors);
  const { stats: usageStats, live: usageLive } = useUsageStats();

  if (loading) {
    return (
      <div className="space-y-8">
        <ShimmerSkeleton className="h-16" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ShimmerSkeleton />
          <ShimmerSkeleton />
          <ShimmerSkeleton />
          <ShimmerSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Site data unavailable"} />;
  }

  const syncVariant = syncBadgeVariant(data.syncStatus);
  const downloads = data.downloads;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mission Control"
        description="Live marketplace sync, downloads, and reach for Cursor Curse Monitor."
        action={
          <Badge variant={syncVariant} pulse={data.syncStatus === "synced"}>
            <StatusDot status={data.syncStatus === "synced" ? "ok" : "warn"} pulse={data.syncStatus === "synced"} />
            {syncStatusLabel(data.syncStatus)}
          </Badge>
        }
      />

      <DriftAlert data={data} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Downloads"
          value={formatCount(downloads?.total ?? 0)}
          sub={
            <span className="text-xs text-[var(--color-muted)]">
              Canonical Open VSX + VS Code + GitHub
              {downloads?.openVsxCombined != null
                ? ` · Open VSX total ${formatCount(downloads.openVsxCombined)}`
                : ""}
            </span>
          }
          icon={<Download className="text-[var(--color-neon)]" size={24} />}
          delayClass="stagger-1"
        />
        <KpiCard
          label="Website Engagement"
          value={formatCount(visitors.totalEngagement)}
          sub={<span className="text-xs text-[var(--color-muted)]">{formatCount(visitors.websiteVisits)} page visits</span>}
          icon={<Activity className="text-[var(--color-accent-2)]" size={24} />}
          delayClass="stagger-2"
        />
        <KpiCard
          label="Active users (now)"
          value={formatCount(usageStats?.optInUniques?.activeNow ?? 0)}
          sub={
            <span className="text-xs text-[var(--color-muted)]">
              {usageLive ? "Live · last 5 min" : "Polling"} · {formatCount(usageStats?.optInUniques?.unique24h ?? 0)} in 24h
            </span>
          }
          icon={<Users className="text-[var(--color-accent)]" size={24} />}
          delayClass="stagger-3"
        />
        <KpiCard
          label="Opt-in installs (all-time)"
          value={formatCount(usageStats?.optInUniques?.uniqueAll ?? 0)}
          sub={
            <span className="text-xs text-[var(--color-muted)]">
              {formatCount(usageStats?.optInUniques?.unique1h ?? 0)} in the last hour
            </span>
          }
          icon={<Activity className="text-[var(--color-accent-2)]" size={24} />}
          delayClass="stagger-4"
        />
        <KpiCard
          label="Open VSX (canonical)"
          value={data.ovsx.version ?? "—"}
          sub={
            <span className="text-xs text-[var(--color-muted)]">
              {data.ovsx.downloadCount != null ? `${formatCount(data.ovsx.downloadCount)} canonical` : "—"}
              {downloads?.openVsxCombined != null ? ` · ${formatCount(downloads.openVsxCombined)} total` : ""}
            </span>
          }
          icon={<Store className="text-[var(--color-neon)]" size={24} />}
          delayClass="stagger-5"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Package Version"
          value={data.packageVersion}
          icon={<Package className="text-[var(--color-accent)]" size={24} />}
          delayClass="stagger-1"
        />
        {data.browserExtension && (
          <KpiCard
            label="Firefox AMO"
            value={data.browserExtension.version ?? "—"}
            sub={
              <span className="text-xs text-[var(--color-muted)]">
                {data.browserExtension.firefox?.published ? "Published on AMO" : "Pending"}
              </span>
            }
            icon={<Store className="text-[var(--color-warn)]" size={24} />}
            delayClass="stagger-2"
          />
        )}
      </div>

      {/* Interactive Trend & Trajectory Graph */}
      <TrafficTrendGraph
        stats={visitors}
        live={visitorsLive}
        optIn24h={usageStats?.optInUniques?.unique24h ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {downloads && (
          <div className="lg:col-span-2">
            <DownloadBreakdownPanel
              total={downloads.total}
              breakdown={downloads.breakdown}
              openVsxCombined={downloads.openVsxCombined}
              note={downloads.note}
            />
          </div>
        )}
        <SyncRadar data={data} />
      </div>

      {/* Marketplace Channel Distribution Donut Graph */}
      <MarketplaceDistributionChart data={data} />

      <VisitorStatsPanel stats={visitors} live={visitorsLive} />

      <ConnectedServicesCard />

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Marketplace Sync Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="pb-3 pr-4 font-medium">Channel</th>
                <th className="pb-3 pr-4 font-medium">Version</th>
                <th className="pb-3 pr-4 font-medium">Downloads</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {[
                {
                  name: "GitHub Releases",
                  version: data.github.releaseTag,
                  downloads: data.github.totalReleaseDownloads,
                  ok: data.github.releaseTag.replace(/^v/, "") === data.packageVersion,
                },
                {
                  name: "Open VSX (canonical)",
                  version: data.ovsx.version ?? "—",
                  downloads: data.ovsx.downloadCount,
                  ok: data.ovsx.version === data.packageVersion,
                },
                {
                  name: "VS Code Marketplace",
                  version: data.vscode.version ?? "—",
                  downloads: data.vscode.downloadCount ?? data.vscode.installCount,
                  ok: data.vscode.version === data.packageVersion,
                },
                ...(data.browserExtension
                  ? [
                      {
                        name: "Firefox Add-ons (AMO)",
                        version: data.browserExtension.version ? `v${data.browserExtension.version}` : "—",
                        downloads: null,
                        ok: Boolean(data.browserExtension.firefox?.published),
                      },
                      {
                        name: "Chrome WebExtension (Zip)",
                        version: data.browserExtension.version ? `v${data.browserExtension.version}` : "—",
                        downloads: null,
                        ok: true,
                      },
                    ]
                  : []),
                {
                  name: "Open VSX (LorapokLabs)",
                  version: data.ovsxDuplicate?.version ?? "—",
                  downloads: data.ovsxDuplicate?.downloadCount,
                  ok: false,
                  warn: true,
                },
              ].map((row) => (
                <tr key={row.name} className="hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 text-[var(--color-text)] font-medium">{row.name}</td>
                  <td className="py-3 pr-4 font-[family-name:var(--font-mono)]">{row.version}</td>
                  <td className="py-3 pr-4 font-[family-name:var(--font-mono)]">
                    {row.downloads != null ? formatCount(row.downloads) : "—"}
                  </td>
                  <td className="py-3">
                    {"warn" in row && row.warn ? (
                      <Badge variant="warn">Legacy listing</Badge>
                    ) : row.ok ? (
                      <Badge variant="synced" pulse>Synced</Badge>
                    ) : (
                      <Badge variant="drift">Behind</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-4">
          Data refreshed {new Date(data.generatedAt).toLocaleString()}
        </p>
      </Card>
    </div>
  );
}
