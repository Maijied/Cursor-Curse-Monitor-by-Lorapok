import { AlertTriangle } from "lucide-react";
import Badge from "./Badge";
import type { SiteData } from "../../lib/site-data";
import { syncStatusLabel } from "../../lib/site-data";

export default function DriftAlert({ data }: { data: SiteData }) {
  if (data.syncStatus === "synced") return null;

  const messages: Record<string, string> = {
    drift: `One or more Open VSX listings are behind package.json (${data.packageVersion}). Run Sync Open VSX workflow.`,
    "dual-listing":
      `Both Open VSX namespaces are active — canonical lorapok-labs (${data.ovsx.version ?? "—"}) and LorapokLabs (${data.ovsxDuplicate?.version ?? "—"}). Versions should match after publish.`,
    "duplicate-listing":
      `Both Open VSX namespaces are active — canonical lorapok-labs (${data.ovsx.version ?? "—"}) and LorapokLabs (${data.ovsxDuplicate?.version ?? "—"}). Run Sync Open VSX to align versions.`,
    ahead: `Open VSX canonical (${data.ovsx.version}) is ahead of package.json (${data.packageVersion}). Bump package version or verify release.`,
    "release-candidate": `Package ${data.packageVersion} is a release candidate — marketplaces may show the version but GitHub release is not published yet.`,
    missing: "Canonical Open VSX listing is missing. Run scripts/publish-ovsx.mjs.",
  };

  return (
    <div className="glass-panel p-4 border-[color-mix(in_srgb,var(--color-warn)_35%,transparent)] flex gap-3 items-start animate-fade-slide-up">
      <AlertTriangle className="text-[var(--color-warn)] shrink-0 mt-0.5" size={20} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold text-[var(--color-text)]">Marketplace drift detected</span>
          <Badge variant="warn">{syncStatusLabel(data.syncStatus)}</Badge>
        </div>
        <p className="text-sm text-[var(--color-muted)]">{messages[data.syncStatus] ?? `Sync status: ${data.syncStatus}`}</p>
      </div>
    </div>
  );
}
