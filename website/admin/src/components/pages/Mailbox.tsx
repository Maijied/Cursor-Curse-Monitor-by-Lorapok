import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, Send, Zap } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import {
  fetchMailbox,
  markMailboxRead,
  sendMailboxMessage,
  sendMailboxTest,
  type MailboxMessage,
} from "../../lib/api";
import { auth } from "../../lib/firebase";

const PAGE_SIZE = 20;

export default function Mailbox() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MailboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, unread: 0, outbound: 0, inbound: 0, failed: 0 });
  const [transport, setTransport] = useState<{ configured: boolean; transport: string; hint?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [direction, setDirection] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testTo, setTestTo] = useState(auth.currentUser?.email ?? "");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchMailbox(page, PAGE_SIZE, { direction, category, status: statusFilter, unread: unreadOnly, q: search })
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setStats(data.stats ?? { total: 0, unread: 0, outbound: 0, inbound: 0, failed: 0 });
        setTransport(data.transport ?? null);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, direction, category, statusFilter, unreadOnly, search]);

  useEffect(() => {
    load();
  }, [load]);

  const inputClass =
    "w-full px-3 py-2 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMessage("");
    try {
      const res = await sendMailboxMessage({ to, subject, text: body });
      setMessage(res.message ?? (res.ok ? "Sent" : "Failed"));
      setBody("");
      load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Send failed");
    }
    setSending(false);
  };

  const handleTest = async () => {
    setSending(true);
    setMessage("");
    try {
      const res = await sendMailboxTest(testTo);
      setMessage(res.message ?? (res.ok ? "Test sent" : "Test failed"));
      load();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Test failed");
    }
    setSending(false);
  };

  const handleMarkRead = async (id: string) => {
    await markMailboxRead(id);
    load();
  };

  if (loading && items.length === 0) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Mailbox"
        description="Transactional outbound mail, subscribe confirmations, invites, and compose."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ["Total", stats.total],
          ["Unread", stats.unread],
          ["Outbound", stats.outbound],
          ["Inbound", stats.inbound],
          ["Failed", stats.failed],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 min-h-[22rem]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail size={18} className="text-[var(--color-accent)]" />
              Messages
            </h3>
            <button type="button" onClick={load} className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-white/5">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }} className={inputClass}>
              <option value="">All directions</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className={inputClass}>
              <option value="">All categories</option>
              <option value="subscribe">Subscribe</option>
              <option value="invite">Invite</option>
              <option value="compose">Compose</option>
              <option value="test">Test</option>
              <option value="notice">Notice</option>
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inputClass}>
              <option value="">Any status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="received">Received</option>
            </select>
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className={inputClass} />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-4">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
            Unread only
          </label>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="pb-3 pr-3 font-medium">Time</th>
                  <th className="pb-3 pr-3 font-medium">To / From</th>
                  <th className="pb-3 pr-3 font-medium">Subject</th>
                  <th className="pb-3 pr-3 font-medium">Category</th>
                  <th className="pb-3 pr-3 font-medium">Status</th>
                  <th className="pb-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--color-muted)]">No messages yet.</td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className={`hover:bg-white/[0.02] ${!row.read ? "bg-white/[0.03]" : ""}`}>
                      <td className="py-3 pr-3 whitespace-nowrap text-[var(--color-muted)]">{new Date(row.ts).toLocaleString()}</td>
                      <td className="py-3 pr-3 font-[family-name:var(--font-mono)] text-xs">
                        <div>{row.direction === "outbound" ? `→ ${row.to}` : `← ${row.from}`}</div>
                      </td>
                      <td className="py-3 pr-3 max-w-xs truncate">{row.subject}</td>
                      <td className="py-3 pr-3"><Badge variant="neutral">{row.category}</Badge></td>
                      <td className="py-3 pr-3">
                        <Badge variant={row.status === "failed" ? "danger" : "synced"}>{row.status}</Badge>
                      </td>
                      <td className="py-3">
                        {!row.read && (
                          <button type="button" onClick={() => handleMarkRead(row.id)} className="text-xs text-[var(--color-accent)] hover:underline">
                            Mark read
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-4">{total} message(s)</p>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold mb-3">Transport</h3>
            {transport ? (
              <div className="space-y-2 text-sm">
                <Badge variant={transport.configured ? "synced" : "danger"}>
                  {transport.configured ? transport.transport : "not configured"}
                </Badge>
                {!transport.configured && transport.hint && (
                  <p className="text-[var(--color-muted)] text-xs leading-relaxed">{transport.hint}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">Unknown</p>
            )}

            <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
              <label className="block text-sm">
                <span className="text-[var(--color-muted)]">Test recipient</span>
                <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <button
                type="button"
                disabled={sending}
                onClick={handleTest}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-60"
              >
                <Zap size={16} /> Send test email
              </button>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Send size={18} className="text-[var(--color-accent-2)]" />
              Compose
            </h3>
            <form onSubmit={handleSend} className="space-y-3">
              <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="To" className={inputClass} />
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Subject" className={inputClass} />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={5} placeholder="Message" className={inputClass} />
              <button type="submit" disabled={sending} className="w-full py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-white/5 font-medium disabled:opacity-60">
                Send message
              </button>
            </form>
          </Card>

          {message && (
            <p className="text-sm p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] text-[var(--color-muted)]">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
