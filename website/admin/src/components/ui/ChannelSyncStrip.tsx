import type { SiteData } from "../../lib/site-data";
import { buildSyncChannels } from "../../lib/syncChannels";
import { formatCount } from "../../lib/site-data";
import Badge from "./Badge";
import Card from "./Card";

type Channel = {
  id: string;
  label: string;
  version: string | null;
  downloadCount?: number;
  synced: boolean;
  warn?: boolean;
};

export default function ChannelSyncStrip({ data, channels: providedChannels }: { data?: SiteData; channels?: Channel[] }) {
  const channels = providedChannels ?? (data ? buildSyncChannels(data) : []);
  const allSynced = channels.filter((c) => !c.warn).every((c) => c.synced);

  return (
    <Card className="h-full animate-fade-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-medium text-[var(--color-muted)]">Channel Sync Strip</h3>
        <Badge variant={allSynced ? "synced" : "drift"} pulse={allSynced}>
          {allSynced ? "All primary synced" : "Drift detected"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {channels.map((ch, i) => (
          <div
            key={ch.id}
            className={`min-w-0 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4 stagger-${Math.min(i + 1, 4)} animate-fade-slide-up`}
          >
            <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)] truncate" title={ch.label}>
                {ch.label}
              </p>
              <div className="shrink-0">
                {ch.warn ? (
                  <Badge variant="warn">Deprecate</Badge>
                ) : ch.synced ? (
                  <Badge variant="synced" pulse>
                    Synced
                  </Badge>
                ) : (
                  <Badge variant="drift">Drift</Badge>
                )}
              </div>
            </div>
            <p className="font-[family-name:var(--font-mono)] text-lg text-[var(--color-text)] tabular-nums">
              {ch.version ?? "—"}
            </p>
            {ch.downloadCount != null && (
              <p className="text-xs text-[var(--color-muted)] mt-1 tabular-nums">
                {formatCount(ch.downloadCount)} downloads
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
