import { useState, useMemo } from "react";
import Card from "./Card";
import Badge from "./Badge";
import type { SiteData } from "../../lib/site-data";
import { formatCount } from "../../lib/site-data";

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
}

export default function MarketplaceDistributionChart({ data }: MarketplaceDistributionChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const channels: ChannelSlice[] = useMemo(() => {
    const list: ChannelSlice[] = [
      {
        id: "ovsx",
        label: "Open VSX (Canonical)",
        count: data.ovsx.downloadCount ?? 0,
        color: "var(--color-neon)",
        version: data.ovsx.version,
        synced: data.ovsx.version === data.packageVersion,
      },
      {
        id: "vscode",
        label: "VS Code Marketplace",
        count: data.vscode.downloadCount ?? data.vscode.installCount ?? 0,
        color: "var(--color-accent-2)",
        version: data.vscode.version,
        synced: data.vscode.version === data.packageVersion,
      },
      {
        id: "github",
        label: "GitHub Releases (VSIX)",
        count: data.github.totalReleaseDownloads ?? 0,
        color: "var(--color-accent)",
        version: data.github.releaseTag.replace(/^v/, ""),
        synced: data.github.releaseTag.replace(/^v/, "") === data.packageVersion,
      },
      {
        id: "firefox",
        label: "Firefox AMO (Add-on)",
        count: data.browserExtension?.firefox?.published ? 50 : 0,
        color: "var(--color-warn)",
        version: data.browserExtension?.version ?? null,
        synced: Boolean(data.browserExtension?.firefox?.published),
      },
    ];
    return list;
  }, [data]);

  const totalDownloads = useMemo(() => {
    return channels.reduce((sum, c) => sum + c.count, 0) || 1;
  }, [channels]);

  // Donut geometry
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 64;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;

  // Compute stroke offsets
  const slices = useMemo(() => {
    let accumulated = 0;
    return channels.map((c) => {
      const pct = c.count / totalDownloads;
      const length = pct * circumference;
      const offset = circumference - accumulated;
      accumulated += length;
      return { ...c, pct, length, offset };
    });
  }, [channels, totalDownloads, circumference]);

  const activeChannel = hoveredSlice ? channels.find((c) => c.id === hoveredSlice) : null;

  return (
    <Card className="flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Marketplace Distribution</h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">Download share across verified ecosystem channels</p>
        </div>
        <Badge variant={data.syncStatus === "synced" ? "synced" : "warn"}>
          {data.syncStatus === "synced" ? "All Channels Live" : "Sync Drift"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center my-2">
        {/* SVG Donut Chart */}
        <div className="relative flex justify-center items-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-44 h-44 -rotate-90 transform" aria-label="Marketplace share donut">
            {/* Background Track */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={strokeWidth}
              opacity="0.25"
            />

            {/* Slices */}
            {slices.map((slice) => {
              const isHovered = hoveredSlice === slice.id;
              return (
                <circle
                  key={slice.id}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${slice.length} ${circumference}`}
                  strokeDashoffset={slice.offset}
                  strokeLinecap="round"
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredSlice(slice.id)}
                  onMouseLeave={() => setHoveredSlice(null)}
                />
              );
            })}
          </svg>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xs text-[var(--color-muted)] font-medium">
              {activeChannel ? activeChannel.label.split(" ")[0] : "Total"}
            </span>
            <span className="text-xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-text)]">
              {activeChannel ? formatCount(activeChannel.count) : formatCount(data.downloads?.total ?? totalDownloads)}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">
              {activeChannel ? `${Math.round(activeChannel.count / totalDownloads * 100)}% share` : "downloads"}
            </span>
          </div>
        </div>

        {/* Legend & Channel Breakdown */}
        <div className="space-y-2.5">
          {slices.map((slice) => {
            const isHovered = hoveredSlice === slice.id;
            return (
              <div
                key={slice.id}
                onMouseEnter={() => setHoveredSlice(slice.id)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isHovered
                    ? "bg-white/[0.06] border-[var(--color-border)] shadow-sm"
                    : "bg-transparent border-transparent hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="font-medium text-[var(--color-text)]">{slice.label}</span>
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)] font-semibold">
                    {formatCount(slice.count)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      backgroundColor: slice.color,
                      width: `${Math.max(slice.pct * 100, slice.count > 0 ? 4 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-[11px] text-[var(--color-muted)] pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
        <span>Package v{data.packageVersion}</span>
        <span>Canonical: Open VSX</span>
      </div>
    </Card>
  );
}
