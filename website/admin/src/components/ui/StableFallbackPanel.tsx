import { ExternalLink, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import type { StableFallbackInfo, StableFallbackVersion } from "../../lib/site-data";

const STABILITY_LABELS: Record<string, string> = {
  stable: "Stable",
  unsafe: "Unsafe",
  legacy: "Legacy",
  unknown: "Unknown",
};

function stabilityVariant(stability: string): "synced" | "warn" | "danger" | "neutral" {
  if (stability === "stable") return "synced";
  if (stability === "unsafe") return "danger";
  if (stability === "legacy") return "warn";
  return "neutral";
}

function StabilityIcon({ stability }: { stability: string }) {
  if (stability === "stable") return <ShieldCheck size={16} className="text-[var(--color-ok)]" aria-hidden="true" />;
  if (stability === "unsafe") return <ShieldAlert size={16} className="text-[var(--color-danger)]" aria-hidden="true" />;
  return <Shield size={16} className="text-[var(--color-warn)]" aria-hidden="true" />;
}

function VersionRow({ row }: { row: StableFallbackVersion }) {
  return (
    <tr className="hover:bg-white/[0.02]">
      <th scope="row" className="py-3 pr-4 font-[family-name:var(--font-mono)] text-[var(--color-text)] text-left">
        {row.tag}
        {row.recommended && (
          <span className="sr-only"> — recommended stable version</span>
        )}
      </th>
      <td className="py-3 pr-4 font-[family-name:var(--font-mono)]">{row.version}</td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <StabilityIcon stability={row.stability} />
          <Badge variant={stabilityVariant(row.stability)}>
            {STABILITY_LABELS[row.stability] ?? row.stability}
          </Badge>
          {row.recommended && <Badge variant="synced" pulse>Recommended</Badge>}
        </div>
      </td>
      <td className="py-3 pr-4 text-[var(--color-muted)] text-xs sm:text-sm">{row.note}</td>
      <td className="py-3">
        <a
          href={row.vsixUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-accent-2)] hover:underline"
        >
          VSIX <ExternalLink size={14} aria-hidden="true" />
        </a>
      </td>
    </tr>
  );
}

export default function StableFallbackPanel({ info }: { info: StableFallbackInfo }) {
  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Stable Fallback Versions</h3>
          <p className="text-sm text-[var(--color-muted)] mt-1 max-w-2xl">
            Extension releases and whether fallback model writes are safe for Cursor&apos;s{" "}
            <code className="text-xs">state.vscdb</code>. Versions below{" "}
            <span className="font-[family-name:var(--font-mono)]">v{info.safeSinceVersion}</span> may cause database conflicts.
          </p>
        </div>
        <div className="shrink-0 p-3 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)] text-sm">
          <p className="text-[var(--color-muted)] text-xs mb-1">Fallback model</p>
          <p className="font-semibold text-[var(--color-text)]">{info.model.displayName}</p>
          <p className="text-xs text-[var(--color-muted)] font-[family-name:var(--font-mono)] mt-1">{info.model.modelId}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-describedby="stable-fallback-caption">
          <caption id="stable-fallback-caption" className="sr-only">
            Stable fallback version matrix for Cursor Curse Monitor releases
          </caption>
          <thead>
            <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <th scope="col" className="pb-3 pr-4 font-medium">Release</th>
              <th scope="col" className="pb-3 pr-4 font-medium">Version</th>
              <th scope="col" className="pb-3 pr-4 font-medium">Fallback safety</th>
              <th scope="col" className="pb-3 pr-4 font-medium">Notes</th>
              <th scope="col" className="pb-3 font-medium">Install</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {info.versions.map((row) => (
              <VersionRow key={row.tag} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--color-muted)] mt-4">
        Recommended stable release:{" "}
        <span className="font-[family-name:var(--font-mono)] text-[var(--color-text)]">v{info.recommendedVersion}</span>
      </p>
    </Card>
  );
}
