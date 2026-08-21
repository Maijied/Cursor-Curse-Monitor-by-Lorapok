import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import { fetchLogs, type LogEntry } from "../../lib/api";

const PAGE_SIZE = 25;

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "api", label: "API" },
  { value: "mail", label: "Mail" },
  { value: "system", label: "System" },
];

const METHOD_OPTIONS = ["", "GET", "POST", "PUT", "DELETE"];

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "2xx", label: "2xx Success" },
  { value: "4xx", label: "4xx Client" },
  { value: "5xx", label: "5xx Server" },
  { value: "failed", label: "Failed mail" },
];

function levelVariant(level: string): "synced" | "warn" | "danger" | "neutral" {
  if (level === "error") return "danger";
  if (level === "warn") return "warn";
  if (level === "info") return "synced";
  return "neutral";
}

function methodColor(method?: string) {
  const m = method?.toUpperCase();
  if (m === "GET") return "text-[var(--color-accent-2)]";
  if (m === "POST") return "text-[var(--color-neon)]";
  if (m === "DELETE") return "text-[var(--color-danger)]";
  return "text-[var(--color-muted)]";
}

export default function Logs() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ api: 0, mail: 0, system: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("all");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");

  const filters = useMemo(
    () => ({ type, method, status, email, q: query }),
    [type, method, status, email, query]
  );

  const load = useCallback(() => {
    setLoading(true);
    fetchLogs(page, PAGE_SIZE, filters)
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setCounts(data.counts ?? { api: 0, mail: 0, system: 0 });
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const inputClass =
    "w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

  if (loading && items.length === 0) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Logs"
        description="Unified API, mail, and system events with server-side filters."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">API events</p>
          <p className="text-2xl font-bold mt-1">{counts.api}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Mail events</p>
          <p className="text-2xl font-bold mt-1">{counts.mail}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">System events</p>
          <p className="text-2xl font-bold mt-1">{counts.system}</p>
        </Card>
      </div>

      <Card className="min-h-[24rem]">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Filter size={18} className="text-[var(--color-accent)]" />
              Filters
            </h3>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-white/5"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="text-sm">
              <span className="block text-[var(--color-muted)] mb-1">Type</span>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                className={inputClass}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-[var(--color-muted)] mb-1">Method</span>
              <select
                value={method}
                onChange={(e) => { setMethod(e.target.value); setPage(1); }}
                className={inputClass}
              >
                <option value="">Any</option>
                {METHOD_OPTIONS.filter(Boolean).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-[var(--color-muted)] mb-1">Status</span>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-[var(--color-muted)] mb-1">Email</span>
              <input
                type="search"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setPage(1); }}
                placeholder="admin@…"
                className={inputClass}
              />
            </label>
            <label className="text-sm sm:col-span-2 lg:col-span-1">
              <span className="block text-[var(--color-muted)] mb-1">Search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="path, subject, message…"
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="pb-3 pr-4 font-medium">Time</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Level</th>
                <th className="pb-3 pr-4 font-medium">Source</th>
                <th className="pb-3 pr-4 font-medium">Detail</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[var(--color-muted)]">
                    No log entries match your filters.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] align-top">
                    <td className="py-3 pr-4 whitespace-nowrap text-[var(--color-muted)]">
                      {new Date(row.ts).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="neutral">{row.type}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={levelVariant(row.level)}>{row.level}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-muted)]">{row.source}</td>
                    <td className="py-3 pr-4 min-w-[12rem]">
                      {row.type === "api" ? (
                        <span className={`font-[family-name:var(--font-mono)] ${methodColor(row.method)}`}>
                          {row.method} {row.path}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text)]">{row.message}</span>
                      )}
                      {row.type === "mail" && row.subject && (
                        <p className="text-xs text-[var(--color-muted)] mt-1 truncate max-w-md">{row.subject}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {row.status != null ? (
                        <Badge variant={typeof row.status === "number" ? (row.status >= 400 ? "warn" : "synced") : row.status === "failed" ? "danger" : "synced"}>
                          {String(row.status)}
                        </Badge>
                      ) : row.latencyMs != null ? (
                        <span className="font-[family-name:var(--font-mono)] text-xs">{row.latencyMs}ms</span>
                      ) : (
                        "—"
                      )}
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-muted)]">
              Page {page} of {totalPages} · {total} matching
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-40"
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
