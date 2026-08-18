import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Mail, PenLine, RefreshCw, Send, Zap } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import Modal from "../ui/Modal";
import Notification, { type NotificationTone } from "../ui/Notification";
import SecurityAlertModal from "../ui/SecurityAlertModal";
import MailboxMessagePreview, { formatMailboxAddress } from "../mailbox/MailboxMessagePreview";
import { scanAdminText, type AdminSecurityFinding } from "../../lib/scanSecrets";
import {
  fetchMailbox,
  markMailboxRead,
  sendMailboxMessage,
  sendMailboxTest,
  type MailboxMessage,
} from "../../lib/api";
import { auth } from "../../lib/firebase";

const PAGE_SIZE = 20;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export default function Mailbox() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MailboxMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, unread: 0, outbound: 0, inbound: 0, failed: 0 });
  const [transport, setTransport] = useState<{ configured: boolean; transport: string; hint?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NotificationTone; title?: string; message: string } | null>(null);

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
  const [selected, setSelected] = useState<MailboxMessage | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [securityFindings, setSecurityFindings] = useState<AdminSecurityFinding[]>([]);
  const isWide = useMediaQuery("(min-width: 1280px)");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
    "w-full min-w-0 px-3 py-2.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-shadow";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const findings = [...scanAdminText(subject, "Subject"), ...scanAdminText(body, "Message body")];
    if (findings.length) {
      setSecurityFindings(findings);
      return;
    }
    setSending(true);
    setNotice(null);
    try {
      const res = await sendMailboxMessage({ to, subject, text: body });
      setNotice({
        tone: res.ok ? "success" : "error",
        title: res.ok ? "Message sent" : "Send failed",
        message: res.message ?? (res.ok ? `Delivered to ${to}` : "Could not send message"),
      });
      if (res.ok) {
        setBody("");
        setSubject("");
        setComposeOpen(false);
      }
      load();
    } catch (err: unknown) {
      setNotice({ tone: "error", title: "Send failed", message: err instanceof Error ? err.message : "Send failed" });
    }
    setSending(false);
  };

  const handleTest = async () => {
    setSending(true);
    setNotice(null);
    try {
      const res = await sendMailboxTest(testTo);
      setNotice({
        tone: res.ok ? "success" : "error",
        title: res.ok ? "Test email sent" : "Test failed",
        message: res.message ?? (res.ok ? `Check inbox for ${testTo}` : res.reason ?? "Transport error"),
      });
      load();
    } catch (err: unknown) {
      setNotice({ tone: "error", title: "Test failed", message: err instanceof Error ? err.message : "Test failed" });
    }
    setSending(false);
  };

  const openMessage = async (row: MailboxMessage) => {
    setSelected(row);
    if (!row.read) {
      await markMailboxRead(row.id);
      setItems((prev) => prev.map((item) => (item.id === row.id ? { ...item, read: true } : item)));
      setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    }
  };

  const previewSubtitle = selected
    ? `${selected.direction === "outbound" ? "To" : "From"} ${
        selected.direction === "outbound" ? selected.to : selected.from
      } · ${new Date(selected.ts).toLocaleString()}`
    : undefined;

  if (loading && items.length === 0) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-fade-slide-up min-w-0">
      {securityFindings.length > 0 && (
        <SecurityAlertModal findings={securityFindings} onDismiss={() => setSecurityFindings([])} />
      )}
      <PageHeader
        title="Mailbox"
        description="Outbound mail from Lorapok Labs — subscribe confirmations, invites, notices, and compose."
        action={
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 shadow-[0_8px_24px_rgba(124,92,255,0.25)] transition-opacity"
          >
            <PenLine size={16} /> Compose
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_80%,transparent)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Transport</span>
          {transport ? (
            <>
              <Badge variant={transport.configured ? "synced" : "danger"}>
                {transport.configured ? transport.transport : "not configured"}
              </Badge>
              {!transport.configured && transport.hint && (
                <span className="text-xs text-[var(--color-muted)] max-w-xl">{transport.hint}</span>
              )}
            </>
          ) : (
            <span className="text-sm text-[var(--color-muted)]">Checking…</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Test recipient"
            className={`${inputClass} !w-auto min-w-[12rem] max-w-xs`}
          />
          <button
            type="button"
            disabled={sending}
            onClick={handleTest}
            className="inline-flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            <Zap size={16} /> Test
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          ["Total", stats.total],
          ["Unread", stats.unread],
          ["Outbound", stats.outbound],
          ["Inbound", stats.inbound],
          ["Failed", stats.failed],
        ].map(([label, value]) => (
          <Card key={label} className="!p-4 border-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-border))]">
            <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      {notice && (
        <Notification
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] gap-6 min-w-0 items-start">
        <Card className="min-w-0 min-h-[28rem] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail size={18} className="text-[var(--color-accent)]" />
              Message log
            </h3>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-[var(--color-border)] hover:bg-white/5 transition-colors"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
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
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search subject or address…"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-4">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
            Unread only
          </label>

          <div className="flex-1 min-h-0 rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-y-auto max-h-[min(52vh,32rem)]">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-[color-mix(in_srgb,var(--color-bg-elevated)_95%,transparent)] backdrop-blur-sm">
                  <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="px-3 py-2.5 font-medium w-[26%]">Time</th>
                    <th className="px-3 py-2.5 font-medium w-[30%]">Address</th>
                    <th className="px-3 py-2.5 font-medium w-[28%]">Subject</th>
                    <th className="px-3 py-2.5 font-medium w-[8%]">Cat.</th>
                    <th className="px-3 py-2.5 font-medium w-[8%]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[var(--color-muted)]">
                        No messages yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => {
                      const active = selected?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${
                            active ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]" : ""
                          } ${!row.read ? "bg-[color-mix(in_srgb,var(--color-accent)_6%,transparent)]" : ""}`}
                          onClick={() => openMessage(row)}
                        >
                          <td className="px-3 py-2.5 text-[var(--color-muted)] text-xs truncate" title={new Date(row.ts).toLocaleString()}>
                            {new Date(row.ts).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </td>
                          <td className="px-3 py-2.5 font-[family-name:var(--font-mono)] text-xs truncate" title={formatMailboxAddress(row)}>
                            {formatMailboxAddress(row)}
                          </td>
                          <td className="px-3 py-2.5 truncate font-medium" title={row.subject}>
                            {row.subject}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`block truncate text-[10px] font-medium uppercase tracking-wide ${
                                row.category === "test" || row.category === "subscribe"
                                  ? "text-[var(--color-neon)]"
                                  : "text-[var(--color-muted)]"
                              }`}
                              title={row.category}
                            >
                              {row.category}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`block truncate text-[10px] font-medium uppercase tracking-wide ${
                                row.status === "failed" ? "text-[var(--color-danger)]" : "text-[var(--color-neon)]"
                              }`}
                              title={row.status}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-muted)]">
              {total} message(s) · page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>

        <Card className="min-w-0 hidden xl:block xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail size={16} className="text-[var(--color-accent-2)]" />
              Preview
            </h3>
            {selected && (
              <button
                type="button"
                onClick={() => setPreviewExpanded(true)}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent-2)] hover:underline"
              >
                <Expand size={14} /> Expand
              </button>
            )}
          </div>
          {selected ? (
            <MailboxMessagePreview message={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[16rem] rounded-xl border border-dashed border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-base)_50%,transparent)] text-center px-4">
              <Mail size={28} className="text-[var(--color-muted)] mb-2 opacity-50" />
              <p className="text-sm text-[var(--color-muted)]">Select a message to preview</p>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Compose message"
        subtitle="Outbound mail uses Lorapok Labs HTML template and secret scanning."
        size="full"
        footer={
          <p className="text-xs text-[var(--color-muted)]">
            Messages are logged in the mailbox and scanned for secrets before send.
          </p>
        }
      >
        <form onSubmit={handleSend} className="space-y-4 max-w-3xl">
          <label className="block text-sm">
            <span className="text-[var(--color-muted)]">Recipient</span>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="name@example.com" className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-muted)]">Subject</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Subject line" className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-muted)]">Message body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={12}
              placeholder="Plain text body — rendered with Lorapok Labs email template on send."
              className={`${inputClass} mt-1 resize-y min-h-[14rem] font-[family-name:var(--font-mono)]`}
            />
          </label>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            <Send size={16} /> {sending ? "Sending…" : "Send message"}
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(selected) && (!isWide || previewExpanded)}
        onClose={() => {
          setSelected(null);
          setPreviewExpanded(false);
        }}
        title={selected?.subject ?? "Message"}
        subtitle={previewSubtitle}
        size="full"
        footer={
          selected && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant={selected.status === "failed" ? "danger" : "synced"}>{selected.status}</Badge>
              <Badge variant="neutral">{selected.category}</Badge>
              {selected.error && <span className="text-[var(--color-danger)]">{selected.error}</span>}
            </div>
          )
        }
      >
        {selected && <MailboxMessagePreview message={selected} expanded />}
      </Modal>
    </div>
  );
}
