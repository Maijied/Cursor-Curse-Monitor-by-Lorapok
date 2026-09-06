import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Shield } from "lucide-react";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import {
  ACL_AUDIT_EVENT_OPTIONS,
  downloadAclAuditCsv,
  fetchAclAudit,
  type AclAuditEntry,
} from "../../lib/api";

const PAGE_SIZE = 25;

function eventVariant(event: string): "synced" | "warn" | "danger" | "neutral" {
  if (event.startsWith("allowlist.remove") || event === "role.clear") return "warn";
  if (event.startsWith("allowlist.add") || event.startsWith("role.")) return "synced";
  return "neutral";
}

export default function AclAuditPanel() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AclAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [event, setEvent] = useState("");
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [query, setQuery] = useState("");

  const filters = useMemo(
    () => ({ event, actor, target, q: query }),
    [event, actor, target, query]
  );

  const load = useCallback(() => {
    setLoading(true);
    fetchAclAudit(page, PAGE_SIZE, filters)
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setEventCounts(data.eventCounts ?? {});
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

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadAclAuditCsv(filters);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
    setExporting(false);
  };

  if (loading && items.length === 0) return <ShimmerSkeleton className="h-64" />;
  if (error && items.length === 0) return <ErrorState message={error} />;

  return (
    <Card className="min-h-[24rem]">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield size={18} className="text-[var(--color-accent)]" />
            ACL audit timeline
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || !total}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-white/5 disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-white/5"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(eventCounts).map(([key, count]) => (
            <Badge key={key} variant="neutral">
              {key}: {count}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">Event</span>
            <select
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All events</option>
              {ACL_AUDIT_EVENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">Actor</span>
            <input
              type="search"
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
              placeholder="who made the change"
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">Target</span>
            <input
              type="search"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setPage(1);
              }}
              placeholder="affected email"
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--color-muted)] mb-1">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="message, role…"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[var(--color-danger)] mb-4">{error}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <th className="pb-3 pr-4 font-medium">Time</th>
              <th className="pb-3 pr-4 font-medium">Event</th>
              <th className="pb-3 pr-4 font-medium">Actor</th>
              <th className="pb-3 pr-4 font-medium">Target</th>
              <th className="pb-3 pr-4 font-medium">Roles</th>
              <th className="pb-3 font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[var(--color-muted)]">
                  No ACL audit entries match your filters.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02] align-top">
                  <td className="py-3 pr-4 whitespace-nowrap text-[var(--color-muted)]">
                    {new Date(row.ts).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={eventVariant(row.event)}>{row.event || "unknown"}</Badge>
                  </td>
                  <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-xs">{row.actor || "—"}</td>
                  <td className="py-3 pr-4 font-[family-name:var(--font-mono)] text-xs">{row.target || "—"}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)] text-xs">
                    {row.previousRole || row.newRole
                      ? `${row.previousRole ?? "—"} → ${row.newRole ?? "—"}`
                      : "—"}
                  </td>
                  <td className="py-3 text-[var(--color-text)]">{row.message}</td>
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
  );
}
