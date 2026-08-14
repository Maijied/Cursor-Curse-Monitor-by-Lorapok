import { useEffect, useState } from "react";
import { ExternalLink, Package } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import { fetchReleases, type Release } from "../../lib/api";

export default function Releases() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReleases()
      .then((data) => { setReleases(data.releases ?? []); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader title="Releases" description="GitHub releases and VSIX download assets." />
      <Card>
        <ul className="divide-y divide-[var(--color-border)]">
          {releases.map((r) => (
            <li key={r.tag} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Package size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
                  <span className="font-semibold font-[family-name:var(--font-mono)]">{r.tag}</span>
                  {r.prerelease && <Badge variant="warn">Pre-release</Badge>}
                  {r.draft && <Badge variant="neutral">Draft</Badge>}
                </div>
                <p className="text-sm text-[var(--color-muted)] mt-1">{r.name}</p>
                <p className="text-xs text-[var(--color-muted)]">{new Date(r.publishedAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {r.vsix && (
                  <a href={r.vsix.browser_download_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-accent-2)] hover:underline">
                    {r.vsix.name}
                  </a>
                )}
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]">
                  GitHub <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
