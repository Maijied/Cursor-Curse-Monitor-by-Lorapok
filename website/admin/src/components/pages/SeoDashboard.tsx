import { useEffect, useState } from "react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";

type SeoManifest = {
  generatedAt: string;
  source?: string;
  title: string;
  description: string;
  version: string;
  packageVersion?: string;
  syncStatus: string;
  canonical: string;
  keywords: string[];
  openGraph?: {
    type: string;
    title: string;
    description: string;
    url: string;
    image: string;
  };
  twitter?: {
    card: string;
    title: string;
    description: string;
    image?: string;
  };
  pages?: Record<string, { title: string; description: string; canonical: string }>;
  structuredData?: { "@context": string; "@graph"?: unknown[] };
  marketplaces: Record<string, string | null>;
};

/**
 * Displays the generated SEO manifest, including metadata, social previews, sitemap pages, structured data, and marketplace links.
 */
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

  const htmlSynced = seo.source?.includes("seo.yml");

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="SEO Dashboard"
        description="Generated from website/seo.yml — single source of truth for meta, sitemap, and JSON-LD."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant={htmlSynced ? "synced" : "warn"}>{htmlSynced ? "YAML-driven" : "legacy"}</Badge>
            <Badge variant={seo.syncStatus === "synced" ? "synced" : "warn"}>{seo.syncStatus}</Badge>
          </div>
        }
      />

      <Card>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-[var(--color-muted)]">Source</dt><dd className="font-[family-name:var(--font-mono)] text-xs">{seo.source ?? "—"}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Package version</dt><dd className="font-[family-name:var(--font-mono)]">{seo.packageVersion ?? seo.version}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Title</dt><dd className="text-[var(--color-text)]">{seo.title}</dd></div>
          <div><dt className="text-[var(--color-muted)]">Version in meta</dt><dd className="font-[family-name:var(--font-mono)]">{seo.version}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--color-muted)]">Description</dt><dd>{seo.description}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[var(--color-muted)]">Canonical</dt><dd><a href={seo.canonical} className="text-[var(--color-accent-2)] hover:underline">{seo.canonical}</a></dd></div>
          <div><dt className="text-[var(--color-muted)]">Generated</dt><dd>{new Date(seo.generatedAt).toLocaleString()}</dd></div>
        </dl>
      </Card>

      {seo.openGraph && (
        <Card>
          <h3 className="font-semibold mb-3">Open Graph</h3>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div><dt className="text-[var(--color-muted)]">og:title</dt><dd>{seo.openGraph.title}</dd></div>
            <div><dt className="text-[var(--color-muted)]">og:description</dt><dd>{seo.openGraph.description}</dd></div>
            <div><dt className="text-[var(--color-muted)]">og:image</dt><dd className="break-all"><a href={seo.openGraph.image} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-2)] hover:underline">{seo.openGraph.image}</a></dd></div>
          </dl>
        </Card>
      )}

      {seo.twitter && (
        <Card>
          <h3 className="font-semibold mb-3">Twitter / X</h3>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div><dt className="text-[var(--color-muted)]">card</dt><dd>{seo.twitter.card}</dd></div>
            <div><dt className="text-[var(--color-muted)]">title</dt><dd>{seo.twitter.title}</dd></div>
            <div><dt className="text-[var(--color-muted)]">description</dt><dd>{seo.twitter.description}</dd></div>
          </dl>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-3">Keywords</h3>
        <div className="flex flex-wrap gap-2">
          {seo.keywords.map((k) => (
            <Badge key={k} variant="neutral">{k}</Badge>
          ))}
        </div>
      </Card>

      {seo.pages && (
        <Card>
          <h3 className="font-semibold mb-3">Pages in sitemap</h3>
          <ul className="space-y-3 text-sm">
            {Object.entries(seo.pages).map(([key, page]) => (
              <li key={key} className="rounded-lg border border-[var(--color-border)] p-3">
                <p className="font-medium text-[var(--color-text)]">{key}</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">{page.title}</p>
                <a href={page.canonical} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent-2)] hover:underline break-all">{page.canonical}</a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {seo.structuredData?.["@graph"] && (
        <Card>
          <h3 className="font-semibold mb-3">Structured data (@graph)</h3>
          <p className="text-sm text-[var(--color-muted)] mb-2">{seo.structuredData["@graph"].length} SoftwareApplication node(s)</p>
          <pre className="text-xs font-[family-name:var(--font-mono)] overflow-x-auto p-3 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border)] max-h-64">
            {JSON.stringify(seo.structuredData, null, 2)}
          </pre>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-3">Marketplace URLs</h3>
        <ul className="space-y-2 text-sm">
          {Object.entries(seo.marketplaces).filter(([, url]) => url).map(([key, url]) => (
            <li key={key}>
              <span className="text-[var(--color-muted)]">{key}: </span>
              <a href={url!} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent-2)] hover:underline break-all">{url}</a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
