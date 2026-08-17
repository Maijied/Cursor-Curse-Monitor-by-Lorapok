import Card from "./Card";
import type { DownloadBreakdown } from "../../lib/site-data";
import { formatCount } from "../../lib/site-data";

const ROWS: { key: keyof DownloadBreakdown; label: string; hint?: string }[] = [
  { key: "openVsxCanonical", label: "Open VSX (lorapok-labs)", hint: "Canonical listing" },
  { key: "vscodeMarketplace", label: "VS Code Marketplace" },
  { key: "githubVsix", label: "GitHub release VSIX", hint: "All release assets" },
  { key: "latestReleaseVsix", label: "Latest release VSIX only" },
  { key: "openVsxDuplicate", label: "Open VSX duplicate", hint: "Excluded from total" },
];

export default function DownloadBreakdownPanel({
  total,
  breakdown,
  note,
}: {
  total: number;
  breakdown: DownloadBreakdown;
  note?: string;
}) {
  return (
    <Card className="h-full">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Total Downloads</h3>
          <p className="text-4xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-neon)] mt-1 tabular-nums">
            {formatCount(total)}
          </p>
        </div>
        {note && <p className="text-xs text-[var(--color-muted)] sm:max-w-xs sm:text-right">{note}</p>}
      </div>

      <div className="space-y-3">
        {ROWS.map(({ key, label, hint }) => {
          const value = breakdown[key] ?? 0;
          const pct = total > 0 && key !== "openVsxDuplicate" ? Math.round((value / total) * 100) : 0;
          return (
            <div key={key} className="group">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between text-sm mb-1">
                <span className="text-[var(--color-text)] min-w-0">
                  {label}
                  {hint && <span className="block sm:inline text-[var(--color-muted)] sm:ml-2 text-xs">{hint}</span>}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)] shrink-0">{formatCount(value)}</span>
              </div>
              {key !== "openVsxDuplicate" && total > 0 && (
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
