import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import SyncRadar from "../ui/SyncRadar";
import ChannelSyncStrip from "../ui/ChannelSyncStrip";
import { fetchMarketplaceSync, type MarketplaceSync } from "../../lib/api";
import { useSiteData } from "../../hooks/useSiteData";
import { formatCount } from "../../lib/site-data";

/**
 * Displays live marketplace synchronization status and channel health.
 *
 * @returns The marketplace health page content
 */
export default function MarketplaceHealth() {
  const { data: siteData } = useSiteData();
  const [live, setLive] = useState<MarketplaceSync | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchMarketplaceSync()
      .then((data) => { setLive(data); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Marketplace Health"
        description="Live channel-by-channel version comparison from registry APIs."
        action={
          <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm text-[var(--color-accent-2)] hover:underline">
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {loading && !live ? <ShimmerSkeleton className="h-48" /> : null}
      {error && !live ? <ErrorState message={error} /> : null}

      {live && (
        <>
          {siteData && <ChannelSyncStrip data={siteData} />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {siteData && <SyncRadar data={siteData} />}
            <Card>
              <h3 className="text-lg font-semibold mb-4">Live sync check</h3>
              <p className="text-xs text-[var(--color-muted)] mb-4">Checked {new Date(live.checkedAt).toLocaleString()}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="pb-2 pr-4">Channel</th>
                    <th className="pb-2 pr-4">Version</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {live.channels.map((ch) => (
                    <tr key={ch.id}>
                      <td className="py-2 pr-4">{ch.label}</td>
                      <td className="py-2 pr-4 font-[family-name:var(--font-mono)]">{ch.version ?? "—"}</td>
                      <td className="py-2">
                        {ch.warn ? (
                          <Badge variant="warn">Deprecate</Badge>
                        ) : ch.synced ? (
                          <Badge variant="synced" pulse>Synced</Badge>
                        ) : (
                          <Badge variant="drift">Drift</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {siteData?.downloads && (
            <Card>
              <h3 className="text-lg font-semibold mb-2">Download snapshot</h3>
              <p className="text-3xl font-bold font-[family-name:var(--font-mono)] text-[var(--color-neon)]">
                {formatCount(siteData.downloads.total)}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-2">{siteData.downloads.note}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
