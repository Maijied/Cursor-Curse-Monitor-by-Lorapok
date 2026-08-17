import { Activity, Download, Package, Store } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import PageHeader from "../layout/PageHeader";
import KpiCard from "../ui/KpiCard";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import StatusDot from "../ui/StatusDot";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import DriftAlert from "../ui/DriftAlert";
import StableFallbackPanel from "../ui/StableFallbackPanel";
import DownloadBreakdownPanel from "../ui/DownloadBreakdown";
import SyncRadar from "../ui/SyncRadar";
import VisitorStatsPanel from "../ui/VisitorStatsPanel";
import { useSiteData } from "../../hooks/useSiteData";
import { useVisitorStats } from "../../hooks/useVisitorStats";
import { syncStatusLabel, formatCount } from "../../lib/site-data";

function syncBadgeVariant(status: string): "synced" | "drift" | "warn" | "danger" | "neutral" {
  if (status === "synced") return "synced";
  if (status === "drift" || status === "duplicate-listing") return "warn";
  if (status === "missing") return "danger";
  return "neutral";
}

export default function Overview() {
  const { data, error, loading } = useSiteData();
  const { stats: visitors, live: visitorsLive } = useVisitorStats(data?.visitors);

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

  const clickChartData = [
    { name: "Open VSX", value: visitors.packageClicks.ovsx ?? 0 },
    { name: "VS Code", value: visitors.packageClicks.vscode ?? 0 },
    { name: "GitHub", value: visitors.packageClicks.github ?? 0 },
    { name: "VSIX", value: visitors.packageClicks.vsix ?? 0 },
    { name: "Duplicate", value: visitors.packageClicks.openvsxDuplicate ?? 0 },
  ];

  const reachChartData = [
    { name: "Visits", value: visitors.websiteVisits },
    { name: "Clicks", value: Object.values(visitors.packageClicks).reduce((s, n) => s + (n ?? 0), 0) },
    { name: "Engagement", value: visitors.totalEngagement },
  ];

  const chartTooltipStyle = {
    backgroundColor: "var(--color-bg-elevated)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.75rem",
    color: "var(--color-text)",
  };

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
          label="Open VSX (canonical)"
          value={data.ovsx.version ?? "—"}
          sub={
            data.ovsx.downloadCount != null ? (
              <span className="text-xs text-[var(--color-muted)]">{formatCount(data.ovsx.downloadCount)} downloads</span>
            ) : undefined
          }
          icon={<Store className="text-[var(--color-neon)]" size={24} />}
          delayClass="stagger-3"
        />
        <KpiCard
          label="Package Version"
          value={data.packageVersion}
          icon={<Package className="text-[var(--color-accent)]" size={24} />}
          delayClass="stagger-4"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Package Click Channels</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clickChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={52}
                />
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="value" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Website Reach</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={reachChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--color-muted)", fontSize: 10 }}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={52}
                />
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-accent-2)"
                  fill="color-mix(in srgb, var(--color-accent-2) 25%, transparent)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {downloads && (
          <div className="min-w-0">
            <DownloadBreakdownPanel
              total={downloads.total}
              breakdown={downloads.breakdown}
              note={downloads.note}
            />
          </div>
        )}
        <div className="min-w-0">
          <SyncRadar data={data} />
        </div>
      </div>

      <VisitorStatsPanel stats={visitors} live={visitorsLive} />

      {data.stableFallback && <StableFallbackPanel info={data.stableFallback} />}

      <p className="text-xs text-[var(--color-muted)] text-center">
        Site data refreshed {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
