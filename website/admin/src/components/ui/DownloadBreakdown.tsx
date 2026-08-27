import Card from "./Card";
import type { DownloadBreakdown } from "../../lib/site-data";
import { formatCount } from "../../lib/site-data";

const ROWS: { key: keyof DownloadBreakdown | "openVsxCombined"; label: string; hint?: string; excludeFromTotal?: boolean }[] = [
  { key: "openVsxCombined", label: "Open VSX total", hint: "Both namespaces combined" },
  { key: "openVsxCanonical", label: "Open VSX (lorapok-labs)", hint: "Canonical listing · in total" },
  { key: "vscodeMarketplace", label: "VS Code Marketplace" },
  { key: "githubAllAssets", label: "GitHub releases", hint: "All release asset downloads" },
  { key: "githubVsix", label: "GitHub (legacy key)", hint: "Same as GitHub releases" },
  { key: "latestReleaseVsix", label: "Latest release VSIX only" },
  { key: "openVsxDuplicate", label: "Open VSX (LorapokLabs)", hint: "Legacy namespace · excluded from total", excludeFromTotal: true },
];

export default function DownloadBreakdownPanel({
  total,
  breakdown,
  openVsxCombined,
  note,
}: {
  total: number;
  breakdown: DownloadBreakdown;
  openVsxCombined?: number;
  note?: string;
}) {
  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Total Downloads</h3>
          <p className="text-4xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-neon)] mt-1">
            {formatCount(total)}
          </p>
        </div>
        {note && <p className="text-xs text-[var(--color-muted)] max-w-xs">{note}</p>}
      </div>

      <div className="space-y-3">
        {ROWS.map(({ key, label, hint, excludeFromTotal }) => {
          const value =
            key === "openVsxCombined"
              ? (openVsxCombined ?? (breakdown.openVsxCanonical ?? 0) + (breakdown.openVsxDuplicate ?? 0))
              : (breakdown[key as keyof DownloadBreakdown] ?? 0);
          const pct = total > 0 && !excludeFromTotal && key !== "openVsxCombined" ? Math.round((value / total) * 100) : 0;
          return (
            <div key={key} className="group">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text)]">
                  {label}
                  {hint && <span className="text-[var(--color-muted)] ml-2 text-xs">{hint}</span>}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)]">{formatCount(value)}</span>
              </div>
              {!excludeFromTotal && key !== "openVsxCombined" && total > 0 && (
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-neon)] transition-all duration-700"
                    style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
