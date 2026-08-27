import Card from "./Card";
import type { DownloadBreakdown } from "../../lib/site-data";
import { formatDownloadCount } from "../../lib/download-stats";

const ROWS: {
  key: keyof DownloadBreakdown | "openVsxCombined";
  label: string;
  hint?: string;
  inTotal?: boolean;
}[] = [
  { key: "openVsxCombined", label: "Open VSX total", hint: "Both namespaces combined", inTotal: false },
  { key: "openVsxCanonical", label: "Open VSX (lorapok-labs)", hint: "Canonical listing · in total", inTotal: true },
  { key: "openVsxDuplicate", label: "Open VSX (LorapokLabs)", hint: "Legacy namespace · in total", inTotal: true },
  { key: "vscodeMarketplace", label: "VS Code Marketplace", inTotal: true },
  { key: "githubAllAssets", label: "GitHub releases", hint: "All release asset downloads", inTotal: true },
  { key: "githubVsix", label: "GitHub (legacy key)", hint: "Same as GitHub releases", inTotal: false },
  { key: "latestReleaseVsix", label: "Latest release VSIX only", inTotal: false },
];

export default function DownloadBreakdownPanel({
  total,
  verified = true,
  breakdown,
  openVsxCombined,
  note,
}: {
  total: number | null;
  verified?: boolean;
  breakdown: DownloadBreakdown;
  openVsxCombined?: number | null;
  note?: string;
}) {
  const displayTotal = verified && total != null ? total : null;

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Total Downloads</h3>
          <p className="text-4xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-neon)] mt-1">
            {formatDownloadCount(displayTotal)}
          </p>
        </div>
        {note && <p className="text-xs text-[var(--color-muted)] max-w-xs">{note}</p>}
      </div>

      <div className="space-y-3">
        {ROWS.map(({ key, label, hint, inTotal = true }) => {
          const raw =
            key === "openVsxCombined"
              ? openVsxCombined ??
                ((breakdown.openVsxCanonical ?? 0) + (breakdown.openVsxDuplicate ?? 0))
              : breakdown[key as keyof DownloadBreakdown];
          const value = verified ? raw : null;
          const numeric = typeof value === "number" ? value : 0;
          const pct =
            displayTotal != null && displayTotal > 0 && inTotal && key !== "openVsxCombined"
              ? Math.round((numeric / displayTotal) * 100)
              : 0;
          return (
            <div key={key} className="group">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text)]">
                  {label}
                  {hint && <span className="text-[var(--color-muted)] ml-2 text-xs">{hint}</span>}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)]">
                  {formatDownloadCount(typeof value === "number" ? value : null)}
                </span>
              </div>
              {inTotal && key !== "openVsxCombined" && displayTotal != null && displayTotal > 0 && (
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-neon)] transition-all duration-700"
                    style={{ width: `${Math.max(pct, numeric > 0 ? 4 : 0)}%` }}
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
