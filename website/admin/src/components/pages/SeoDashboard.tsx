import { useEffect, useState } from "react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";

type SeoManifest = {
  generatedAt: string;
  title: string;
  description: string;
  version: string;
  syncStatus: string;
  canonical: string;
  keywords: string[];
  marketplaces: Record<string, string>;
};

export default function SeoDashboard() {
  const [seo, setSeo] = useState<SeoManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/seo.json")
      .then((res) => {
        if (!res.ok) throw new Error("seo.json not found");
        return res.json();
      })
      .then(setSeo)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ShimmerSkeleton className="h-64" />;
  if (error || !seo) return <ErrorState message={error ?? "SEO manifest unavailable"} />;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="SEO Dashboard"
        description="Machine-readable SEO manifest from generate-seo.mjs."
        action={<Badge variant={seo.syncStatus === "synced" ? "synced" : "warn"}>{seo.syncStatus}</Badge>}
      />

      <Card>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-[var(--color-muted)]">Title</dt><dd className="text-[var(--color-text)]">{seo.title}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Version in meta</dt><dd className="font-[family-name:var(--font-mono)]">{seo.version}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--color-muted)]">Description</dt><dd>{seo.description}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--color-muted)]">Canonical</dt><dd><a href={seo.canonical} className="text-[var(--color-accent-2)] hover:underline">{seo.canonical}</a></dd></div>
          <div><dt className="text-[var(--color-muted)]">Generated</dt><dd>{new Date(seo.generatedAt).toLocaleString()}</dd></div>
        </dl>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Keywords</h3>
        <div className="flex flex-wrap gap-2">
          {seo.keywords.map((k) => (
            <Badge key={k} variant="neutral">{k}</Badge>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3">Marketplace URLs</h3>
        <ul className="space-y-2 text-sm">
          {Object.entries(seo.marketplaces).map(([key, url]) => (
            <li key={key}>
              <span className="text-[var(--color-muted)]">{key}: </span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-2)] hover:underline break-all">{url}</a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
