import { useMemo, useState } from "react";
import Card from "./Card";
import Badge from "./Badge";
import type { SiteData } from "../../lib/site-data";
import { syncStatusLabel } from "../../lib/site-data";
import {
  buildDownloadChannelSlices,
  downloadStatsAvailabilityLabel,
  formatDownloadCount,
  getDisplayDownloadTotal,
  isDownloadStatsVerified,
} from "../../lib/download-stats";

interface MarketplaceDistributionChartProps {
  data: SiteData;
}

const DONUT_SIZE = 180;
const DONUT_RADIUS = 64;
const DONUT_STROKE = 20;

const CHANNEL_COLORS: Record<string, string> = {
  "ovsx-canonical": "var(--color-neon)",
  "ovsx-duplicate": "#94a3b8",
  vscode: "var(--color-accent-2)",
  github: "var(--color-accent)",
};

/** Build cumulative stroke-dash segments for a multi-slice donut (SVG circles, -90° rotation). */
export function buildDonutStrokeSlices(
  channels: Array<{ id: string; count: number }>,
  total: number,
  circumference: number,
) {
  const safeTotal = total > 0 ? total : 1;
  let cumulative = 0;

  return channels
    .filter((channel) => channel.count > 0)
    .map((channel) => {
      const length = (channel.count / safeTotal) * circumference;
      const dashOffset = -cumulative;
      cumulative += length;
      return {
        id: channel.id,
        length,
        dashOffset,
        pct: channel.count / safeTotal,
      };
    });
}

export default function MarketplaceDistributionChart({ data }: MarketplaceDistributionChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const channelSlices = useMemo(() => buildDownloadChannelSlices(data), [data]);
  const totalDownloads = getDisplayDownloadTotal(data);
  const openVsxCombined = data.downloads?.openVsxCombined ?? null;
  const verified = isDownloadStatsVerified(data);

  const channels = useMemo(
    () =>
      channelSlices.map((slice) => ({
        ...slice,
        color: CHANNEL_COLORS[slice.id] ?? "var(--color-muted)",
        version:
          slice.id === "ovsx-canonical"
            ? data.ovsx.version
            : slice.id === "ovsx-duplicate"
              ? data.ovsxDuplicate?.version ?? null
              : slice.id === "vscode"
                ? data.vscode.version
                : data.github.releaseTag.replace(/^v/, ""),
        synced:
          slice.id === "ovsx-canonical"
            ? data.ovsx.version === data.packageVersion
            : slice.id === "ovsx-duplicate"
              ? false
              : slice.id === "vscode"
                ? data.vscode.version === data.packageVersion
                : data.github.releaseTag.replace(/^v/, "") === data.packageVersion,
      })),
    [channelSlices, data],
  );

  const circumference = 2 * Math.PI * DONUT_RADIUS;
  const cx = DONUT_SIZE / 2;
  const cy = DONUT_SIZE / 2;

  const donutSlices = useMemo(() => {
    if (totalDownloads == null) return [];
    const geometry = buildDonutStrokeSlices(channels, totalDownloads, circumference);
    return geometry.map((slice) => {
      const channel = channels.find((c) => c.id === slice.id);
      return { ...channel!, ...slice };
    });
  }, [channels, totalDownloads, circumference]);

  const activeChannel = hoveredSlice ? channels.find((channel) => channel.id === hoveredSlice) ?? null : null;
  const syncOk = data.syncStatus === "synced";

  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Marketplace Distribution</h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            {verified
              ? `Verified grand total · ${formatDownloadCount(openVsxCombined)} Open VSX across both namespaces`
              : totalDownloads != null
                ? `${downloadStatsAvailabilityLabel(data)} · ${formatDownloadCount(openVsxCombined)} Open VSX combined`
                : "Live marketplace stats unavailable — no placeholder counts shown"}
          </p>
        </div>
        <Badge variant={syncOk ? "synced" : "warn"}>{syncOk ? "All channels live" : syncStatusLabel(data.syncStatus)}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center my-2">
        <div className="relative flex justify-center items-center">
          <svg
            viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
            className="w-44 h-44 -rotate-90"
            aria-label="Marketplace download share donut"
          >
            <circle
              cx={cx}
              cy={cy}
              r={DONUT_RADIUS}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={DONUT_STROKE}
              opacity="0.25"
            />

            {donutSlices.length === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={DONUT_RADIUS}
                fill="none"
                stroke="var(--color-muted)"
                strokeWidth={DONUT_STROKE}
                opacity="0.35"
                strokeDasharray={`${circumference * 0.08} ${circumference}`}
              />
            ) : (
              donutSlices.map((slice) => {
                const isHovered = hoveredSlice === slice.id;
                return (
                  <circle
                    key={slice.id}
                    cx={cx}
                    cy={cy}
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isHovered ? DONUT_STROKE + 4 : DONUT_STROKE}
                    strokeDasharray={`${slice.length} ${circumference}`}
                    strokeDashoffset={slice.dashOffset}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoveredSlice(slice.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                );
              })
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] font-medium">
              {activeChannel ? activeChannel.label : "Grand total"}
            </span>
            <span className="text-xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-text)]">
              {activeChannel
                ? formatDownloadCount(activeChannel.count)
                : formatDownloadCount(totalDownloads)}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">
              {activeChannel && totalDownloads != null && totalDownloads > 0
                ? `${Math.round((activeChannel.count / totalDownloads) * 100)}% of total`
                : totalDownloads != null
                  ? verified
                    ? "downloads"
                    : "marketplace live"
                  : "unavailable"}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {channels.map((channel) => {
            const pct =
              totalDownloads != null && totalDownloads > 0 ? channel.count / totalDownloads : 0;
            const isHovered = hoveredSlice === channel.id;
            return (
              <div
                key={channel.id}
                onMouseEnter={() => setHoveredSlice(channel.id)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isHovered
                    ? "bg-white/[0.06] border-[var(--color-border)] shadow-sm"
                    : "bg-transparent border-transparent hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: channel.color }} />
                    <span className="font-medium text-[var(--color-text)] truncate">{channel.label}</span>
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)] font-semibold shrink-0">
                    {formatDownloadCount(channel.count)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      backgroundColor: channel.color,
                      width: `${Math.max(pct * 100, channel.count > 0 ? 2 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[11px] text-[var(--color-muted)] pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
        <span>Package v{data.packageVersion}</span>
        <span>
          Open VSX {formatDownloadCount(channels.find((c) => c.id === "ovsx-canonical")?.count ?? null)} canonical ·{" "}
          {formatDownloadCount(openVsxCombined)} combined
        </span>
      </div>
    </Card>
  );
}
