import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Optional searchable text extractor (defaults to String of render result when possible). */
  searchValue?: (row: T) => string;
};

const PAGE_SIZE = 10;

export default function DataTable<T>({
  columns,
  rows,
  filterOptions,
  filterValue,
  onFilterChange,
  filterLabel = "Filter",
  emptyMessage = "No rows to display.",
  getRowKey,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  filterOptions?: Array<{ value: string; label: string }>;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterLabel?: string;
  emptyMessage?: string;
  getRowKey: (row: T, index: number) => string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => {
        const raw = col.searchValue?.(row);
        if (raw != null) return raw.toLowerCase().includes(q);
        return false;
      })
    );
  }, [rows, query, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            aria-label="Search table"
          />
        </div>
        {filterOptions && onFilterChange && (
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <span className="sr-only sm:not-sr-only">{filterLabel}</span>
            <select
              value={filterValue ?? ""}
              onChange={(e) => {
                onFilterChange(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)] text-[var(--color-text)]"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
              {columns.map((col) => (
                <th key={col.key} className={`pb-3 pr-4 font-medium last:pr-0 ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-[var(--color-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={getRowKey(row, i)} className="hover:bg-white/[0.02]">
                  {columns.map((col) => (
                    <td key={col.key} className={`py-3 pr-4 last:pr-0 ${col.className ?? ""}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-[var(--color-muted)]">
        <span>
          {filtered.length === 0
            ? "0 results"
            : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="font-[family-name:var(--font-mono)] text-xs">
            {safePage}/{totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5"
            aria-label="Next page"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
