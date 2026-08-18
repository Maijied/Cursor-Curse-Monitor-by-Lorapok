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
        {ROWS.map(({ key, label, hint }) => {
          const value = breakdown[key] ?? 0;
          const pct = total > 0 && key !== "openVsxDuplicate" ? Math.round((value / total) * 100) : 0;
          return (
            <div key={key} className="group">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text)]">
                  {label}
                  {hint && <span className="text-[var(--color-muted)] ml-2 text-xs">{hint}</span>}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)]">{formatCount(value)}</span>
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
