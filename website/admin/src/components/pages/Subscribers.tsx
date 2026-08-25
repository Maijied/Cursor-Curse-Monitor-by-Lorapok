import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, RefreshCw, Send } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import DataTable, { type DataTableColumn } from "../ui/DataTable";
import { broadcastToSubscribers, fetchSubscribers, type SubscriberRecord } from "../../lib/api";
import Notification from "../ui/Notification";

function exportCsv(rows: SubscriberRecord[]) {
  const header = ["email", "source", "subscribedAt", "installId", "consentVersion"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [row.email, row.source, row.subscribedAt, row.installId ?? "", row.consentVersion]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ccm-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Subscribers() {
  const [items, setItems] = useState<SubscriberRecord[]>([]);
  const [stats, setStats] = useState<{ total: number; withInstallId: number; bySource: Record<string, number> } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSubscribers();
      setItems(data.items ?? []);
      setStats(data.stats ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load subscribers");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const emailAll = async () => {
    const title = window.prompt("Email subject / notice title");
    if (!title?.trim()) return;
    const message = window.prompt("Full message body for subscribers");
    if (!message?.trim()) return;
    if (!window.confirm(`Send "${title}" to ${items.length} subscriber(s)?`)) return;

    setBroadcasting(true);
    setNotice(null);
    try {
      const result = await broadcastToSubscribers({
        title: title.trim(),
        message: message.trim(),
        severity: "info",
        feedbackUrl: "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/issues",
      });
      setNotice({ tone: result.failed ? "error" : "success", message: result.message || "Broadcast complete." });
    } catch (err: unknown) {
      setNotice({ tone: "error", message: err instanceof Error ? err.message : "Broadcast failed" });
    }
    setBroadcasting(false);
  };

  const columns: DataTableColumn<SubscriberRecord>[] = useMemo(
    () => [
      {
        key: "email",
        header: "Email",
        searchValue: (row) => row.email,
        render: (row) => <span className="font-[family-name:var(--font-mono)] text-sm">{row.email}</span>,
      },
      {
        key: "source",
        header: "Source",
        searchValue: (row) => row.source,
        render: (row) => <Badge variant="neutral">{row.source}</Badge>,
      },
      {
        key: "subscribedAt",
        header: "Subscribed",
        searchValue: (row) => row.subscribedAt,
        render: (row) => (
          <span className="text-sm text-[var(--color-muted)]">
            {row.subscribedAt ? new Date(row.subscribedAt).toLocaleString() : "—"}
          </span>
        ),
      },
      {
        key: "installId",
        header: "Install ID",
        searchValue: (row) => row.installId ?? "",
        render: (row) => (
          <span className="text-xs text-[var(--color-muted)] font-[family-name:var(--font-mono)]">
            {row.installId ? `${row.installId.slice(0, 8)}…` : "—"}
          </span>
        ),
      },
    ],
    []
  );

  if (loading) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Subscribers"
        description="Opt-in release update emails from the website, extension, and browser add-on. Marketplace installs do not expose emails — only consented addresses appear here."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void emailAll()}
              disabled={!items.length || broadcasting}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-accent)]/40 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
            >
              <Send size={14} aria-hidden="true" />
              Email all subscribers
            </button>
            <button
              type="button"
              onClick={() => exportCsv(items)}
              disabled={!items.length}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm hover:bg-white/5 disabled:opacity-50"
            >
              <Download size={14} aria-hidden="true" />
              Export CSV
            </button>
          </div>
        }
      />

      {notice && (
        <Notification tone={notice.tone} message={notice.message} onDismiss={() => setNotice(null)} />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Total subscribers</p>
          <p className="text-3xl font-semibold mt-2">{stats?.total ?? items.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Linked to install ID</p>
          <p className="text-3xl font-semibold mt-2">{stats?.withInstallId ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-muted)]">Sources</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(stats?.bySource ?? {}).map(([source, count]) => (
              <Badge key={source} variant="neutral">
                {source}: {count}
              </Badge>
            ))}
            {!Object.keys(stats?.bySource ?? {}).length && (
              <span className="text-sm text-[var(--color-muted)]">No subscribers yet</span>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4 text-[var(--color-muted)] text-sm">
          <Mail size={16} aria-hidden="true" />
          Use Mailbox → Compose to email this list, or export CSV for external campaigns.
        </div>
        <DataTable columns={columns} rows={items} rowKey={(row, index) => `${row.email}-${index}`} />
      </Card>
    </div>
  );
}
