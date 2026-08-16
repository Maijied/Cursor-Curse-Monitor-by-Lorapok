import { Download, Eye, MousePointerClick } from "lucide-react";
import Card from "./Card";
import type { VisitorStats } from "../../lib/site-data";
import { formatCount } from "../../lib/site-data";

type PackageClickKey = keyof NonNullable<VisitorStats["packageClicks"]>;

const CLICK_CHANNELS: { key: PackageClickKey; label: string }[] = [
  { key: "ovsx", label: "Open VSX" },
  { key: "vscode", label: "VS Code Marketplace" },
  { key: "github", label: "GitHub / repo" },
  { key: "vsix", label: "VSIX download" },
  { key: "openvsxDuplicate", label: "Duplicate listing" },
];

export default function VisitorStatsPanel({ stats, live }: { stats: VisitorStats; live?: boolean }) {
  const clicks = stats.packageClicks ?? {};
  const clickTotal = Object.values(clicks).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">Website & Package Reach</h3>
        {live && (
          <span className="text-xs text-[var(--color-neon)] flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon)] animate-pulse-neon" />
            Live
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] min-h-[5.5rem]">
          <div className="flex items-center gap-2 text-[var(--color-muted)] text-sm mb-2">
            <Eye size={16} aria-hidden="true" />
            Website visits
          </div>
          <p className="text-2xl font-bold font-[family-name:var(--font-mono)] tabular-nums">{formatCount(stats.websiteVisits)}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] min-h-[5.5rem]">
          <div className="flex items-center gap-2 text-[var(--color-muted)] text-sm mb-2">
            <MousePointerClick size={16} aria-hidden="true" />
            Package clicks
          </div>
          <p className="text-2xl font-bold font-[family-name:var(--font-mono)] tabular-nums">{formatCount(clickTotal)}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] min-h-[5.5rem] sm:col-span-1 col-span-1">
          <div className="flex items-center gap-2 text-[var(--color-muted)] text-sm mb-2">
            <Download size={16} aria-hidden="true" />
            Total engagement
          </div>
          <p className="text-2xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-accent-2)] tabular-nums">
            {formatCount(stats.totalEngagement)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
        {CLICK_CHANNELS.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-[var(--color-border)] min-w-0"
          >
            <span className="text-[var(--color-muted)] truncate">{label}</span>
            <span className="font-[family-name:var(--font-mono)] tabular-nums shrink-0">{formatCount(clicks[key] ?? 0)}</span>
          </div>
        ))}
      </div>

      {stats.updatedAt && (
        <p className="text-xs text-[var(--color-muted)] mt-4">
          Last activity {new Date(stats.updatedAt).toLocaleString()}
        </p>
      )}
    </Card>
  );
}
