import { useMemo, useState } from "react";
import Card from "./Card";
import Badge from "./Badge";
import type { SiteData } from "../../lib/site-data";
import { formatCount, syncStatusLabel } from "../../lib/site-data";

interface MarketplaceDistributionChartProps {
  data: SiteData;
}

interface ChannelSlice {
  id: string;
  label: string;
  count: number;
  color: string;
  version: string | null;
  synced: boolean;
  inTotal: boolean;
}

const DONUT_SIZE = 180;
const DONUT_RADIUS = 64;
const DONUT_STROKE = 20;

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

  const breakdown = data.downloads?.breakdown;

  const channels: ChannelSlice[] = useMemo(
    () => [
      {
        id: "ovsx",
        label: "Open VSX (canonical)",
        count: breakdown?.openVsxCanonical ?? data.ovsx.downloadCount ?? 0,
        color: "var(--color-neon)",
        version: data.ovsx.version,
        synced: data.ovsx.version === data.packageVersion,
        inTotal: true,
      },
      {
        id: "vscode",
        label: "VS Code Marketplace",
        count: breakdown?.vscodeMarketplace ?? data.vscode.downloadCount ?? data.vscode.installCount ?? 0,
        color: "var(--color-accent-2)",
        version: data.vscode.version,
        synced: data.vscode.version === data.packageVersion,
        inTotal: true,
      },
      {
        id: "github",
        label: "GitHub releases",
        count: breakdown?.githubAllAssets ?? data.github.totalReleaseDownloads ?? 0,
        color: "var(--color-accent)",
        version: data.github.releaseTag.replace(/^v/, ""),
        synced: data.github.releaseTag.replace(/^v/, "") === data.packageVersion,
        inTotal: true,
      },
      {
        id: "firefox",
        label: "Firefox AMO",
        count: data.browserExtension?.firefox?.downloadCount ?? 0,
        color: "var(--color-warn)",
        version: data.browserExtension?.version ?? null,
        synced: Boolean(data.browserExtension?.firefox?.published),
        inTotal: true,
      },
    ],
    [breakdown, data],
  );

  const legacyNamespace = useMemo(
    () => ({
      id: "ovsx-legacy",
      label: "Open VSX (LorapokLabs)",
      count: breakdown?.openVsxDuplicate ?? data.ovsxDuplicate?.downloadCount ?? 0,
      version: data.ovsxDuplicate?.version ?? null,
    }),
    [breakdown, data],
  );

  const totalDownloads = data.downloads?.total ?? channels.reduce((sum, channel) => sum + channel.count, 0);
  const openVsxCombined =
    data.downloads?.openVsxCombined ?? (channels[0]?.count ?? 0) + legacyNamespace.count;

  const circumference = 2 * Math.PI * DONUT_RADIUS;
  const cx = DONUT_SIZE / 2;
  const cy = DONUT_SIZE / 2;

  const donutSlices = useMemo(() => {
    const geometry = buildDonutStrokeSlices(channels, totalDownloads, circumference);
    return geometry.map((slice) => {
      const channel = channels.find((c) => c.id === slice.id);
      return { ...channel!, ...slice };
    });
  }, [channels, totalDownloads, circumference]);

  const activeChannel = hoveredSlice
    ? channels.find((channel) => channel.id === hoveredSlice) ??
      (hoveredSlice === legacyNamespace.id ? { ...legacyNamespace, color: "#94a3b8", synced: false, inTotal: false } : null)
    : null;

  const syncOk = data.syncStatus === "synced";

  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Marketplace Distribution</h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Canonical download share · {formatCount(openVsxCombined)} Open VSX total across both namespaces
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
              {activeChannel ? activeChannel.label : "Canonical total"}
            </span>
            <span className="text-xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-text)]">
              {activeChannel ? formatCount(activeChannel.count) : formatCount(totalDownloads)}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">
              {activeChannel && totalDownloads > 0
                ? `${Math.round((activeChannel.count / totalDownloads) * 100)}% of total`
                : "downloads"}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {channels.map((channel) => {
            const pct = totalDownloads > 0 ? channel.count / totalDownloads : 0;
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
                    {formatCount(channel.count)}
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

          <div
            onMouseEnter={() => setHoveredSlice(legacyNamespace.id)}
            onMouseLeave={() => setHoveredSlice(null)}
            className={`p-2 rounded-xl border border-dashed transition-all ${
              hoveredSlice === legacyNamespace.id
                ? "border-[var(--color-border)] bg-white/[0.04]"
                : "border-transparent bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#94a3b8]" />
                <span className="font-medium text-[var(--color-muted)] truncate">{legacyNamespace.label}</span>
              </div>
              <span className="font-[family-name:var(--font-mono)] text-[var(--color-muted)] font-semibold shrink-0">
                {formatCount(legacyNamespace.count)}
              </span>
            </div>
            <p className="text-[10px] text-[var(--color-muted)] mt-1">Legacy namespace · excluded from canonical total</p>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-[var(--color-muted)] pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
        <span>Package v{data.packageVersion}</span>
        <span>
          Open VSX {formatCount(channels[0]?.count ?? 0)} canonical · {formatCount(openVsxCombined)} combined
        </span>
      </div>
    </Card>
  );
}
