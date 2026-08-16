import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import { fetchApiActivity, type ApiActivityEntry } from "../../lib/api";

const PAGE_SIZE = 25;

function statusVariant(status: number): "synced" | "warn" | "danger" | "neutral" {
  if (status >= 200 && status < 300) return "synced";
  if (status >= 400 && status < 500) return "warn";
  if (status >= 500) return "danger";
  return "neutral";
}

function methodColor(method: string) {
  const m = method.toUpperCase();
  if (m === "GET") return "text-[var(--color-accent-2)]";
  if (m === "POST") return "text-[var(--color-neon)]";
  if (m === "DELETE") return "text-[var(--color-danger)]";
  return "text-[var(--color-muted)]";
}

export default function ApiActivity() {
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<ApiActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchApiActivity(page, PAGE_SIZE)
      .then((data) => {
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading && entries.length === 0) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="API Activity"
        description="Authenticated admin API requests — method, path, status, and latency."
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="pb-3 pr-4 font-medium">Time</th>
                <th className="pb-3 pr-4 font-medium">Method</th>
                <th className="pb-3 pr-4 font-medium">Path</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Latency</th>
                <th className="pb-3 font-medium">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--color-muted)]">
                    No API activity recorded yet.
                  </td>
                </tr>
              ) : (
                entries.map((row, i) => (
                  <tr key={row.id ?? `${row.timestamp}-${i}`} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 whitespace-nowrap text-[var(--color-muted)]">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className={`py-3 pr-4 font-[family-name:var(--font-mono)] font-medium ${methodColor(row.method)}`}>
                      {row.method}
                    </td>
                    <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-[var(--color-text)] max-w-xs truncate">
                      {row.path}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-[var(--color-text)]">
                      {row.latencyMs}ms
                    </td>
                    <td className="py-3 text-[var(--color-muted)] truncate max-w-[10rem]">
                      {row.email ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-muted)]">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`min-w-[2.25rem] px-2 py-1.5 rounded-lg text-sm border transition-colors ${
                      p === page
                        ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] hover:bg-white/5 text-[var(--color-muted)]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
