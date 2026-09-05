import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CloudUpload, Mail, PenLine, RefreshCw, Send, Sparkles, Zap } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import Modal from "../ui/Modal";
import Notification, { type NotificationTone } from "../ui/Notification";
import LorapokLarvaeLoader, { LarvaeLoaderOverlay } from "../ui/LorapokLarvaeLoader";
import SecurityAlertModal from "../ui/SecurityAlertModal";
import MailboxMessagePreview from "../mailbox/MailboxMessagePreview";
import { formatMailboxAddress } from "../mailbox/mailbox-format";
import { scanAdminText, type AdminSecurityFinding } from "../../lib/scanSecrets";
import {
  fetchMailbox,
  fetchMailTemplates,
  fetchTestmailConfigApi,
  markMailboxRead,
  pollTestmailInbox,
  sendMailboxMessage,
  sendMailboxTest,
  startMailboxTestmailProbe,
  syncMailTransport,
  type MailboxMessage,
  type MailTemplate,
} from "../../lib/api";
import { auth } from "../../lib/firebase";
import { useAuthSession } from "../../lib/auth-context";
import ReadOnlyAclBanner from "../ui/ReadOnlyAclBanner";

const PAGE_SIZE = 20;

/**
 * Tracks whether the current viewport matches a CSS media query.
 *
 * @param query - The CSS media query to evaluate
 * @returns `true` if the media query matches, `false` otherwise
 */
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

/**
 * Displays a responsive mailbox interface for monitoring, filtering, previewing, testing, and composing messages.
 */
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
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [selectedMailTemplate, setSelectedMailTemplate] = useState("");
  const [composeCategory, setComposeCategory] = useState("compose");
  const [securityFindings, setSecurityFindings] = useState<AdminSecurityFinding[]>([]);
  const [syncingMail, setSyncingMail] = useState(false);
  const [testmailProbing, setTestmailProbing] = useState(false);
  const [testmailProbeEnabled, setTestmailProbeEnabled] = useState(false);
  const testmailPollRef = useRef<number | null>(null);
  const { hasPermission } = useAuthSession();
  const canSendMail = hasPermission("mail.send");
  const canSyncInfra = hasPermission("deploy.infra");
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

  useEffect(() => {
    fetchMailTemplates()
      .then((data) => setMailTemplates(data.templates ?? []))
      .catch(() => setMailTemplates([]));
  }, []);

  useEffect(() => {
    fetchTestmailConfigApi()
      .then((data) => setTestmailProbeEnabled(Boolean(data.config?.probeEnabled)))
      .catch(() => setTestmailProbeEnabled(false));
  }, []);

  useEffect(() => {
    return () => {
      if (testmailPollRef.current) window.clearInterval(testmailPollRef.current);
    };
  }, []);

  const inputClass =
    "w-full min-w-0 px-3 py-2.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-shadow";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSendMail) return;
    const findings = [...scanAdminText(subject, "Subject"), ...scanAdminText(body, "Message body")];
    if (findings.length) {
      setSecurityFindings(findings);
      return;
    }
    setSending(true);
    setNotice(null);
    try {
      const res = await sendMailboxMessage({ to, subject, text: body, category: composeCategory });
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
    if (!canSendMail) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await sendMailboxTest(testTo);
      setNotice({
        tone: res.ok ? "success" : "error",
        title: res.ok ? "Test email sent" : "Test failed",
        message:
          res.message ??
          (res.ok
            ? `Check inbox for ${testTo}`
            : res.reason?.includes("401")
              ? `${res.reason} — Redeploy Mission Control so the ccm-mail-relay worker is bound, or run: node website/admin/scripts/enable-mail.mjs`
              : res.reason ?? "Transport error"),
      });
      load();
    } catch (err: unknown) {
      setNotice({ tone: "error", title: "Test failed", message: err instanceof Error ? err.message : "Test failed" });
    }
    setSending(false);
  };

  const handleSyncUp = async () => {
    if (!canSyncInfra) {
      setNotice({
        tone: "warning",
        title: "Permission required",
        message: "Mail sync dispatches deploy-infra (enable-mail + Pages redeploy). Requires deploy.infra permission.",
      });
      return;
    }
    setSyncingMail(true);
    setNotice(null);
    try {
      const res = await syncMailTransport();
      const tips = res.recommendations?.length ? `\n\n${res.recommendations.join("\n")}` : "";
      setNotice({
        tone: res.ok ? "success" : "error",
        title: res.ok ? "Mail sync started" : "Mail sync failed",
        message: `${res.message ?? (res.ok ? "CI is repairing outbound mail." : "Could not dispatch workflow.")}${tips}`,
      });
      load();
    } catch (err: unknown) {
      setNotice({
        tone: "error",
        title: "Mail sync failed",
        message: err instanceof Error ? err.message : "Mail sync failed",
      });
    }
    setSyncingMail(false);
  };

  const handleTestmailE2E = async () => {
    if (!canSendMail) return;
    setTestmailProbing(true);
    setNotice(null);
    if (testmailPollRef.current) {
      window.clearInterval(testmailPollRef.current);
      testmailPollRef.current = null;
    }
    try {
      const started = await startMailboxTestmailProbe();
      if (!started.ok) {
        setNotice({
          tone: "error",
          title: "Testmail probe failed",
          message: started.reason ?? started.message ?? "Could not send welcome mail to testmail.app",
        });
        setTestmailProbing(false);
        load();
        return;
      }

      const tag = started.tag ?? "";
      const since = started.since ?? Date.now() - 5_000;
      setNotice({
        tone: "info",
        title: "Testmail probe sent",
        message: `Waiting for ${started.to ?? "testmail inbox"} via ${started.transport ?? "transport"}…`,
      });

      let attempts = 0;
      const poll = async (): Promise<boolean> => {
        attempts += 1;
        try {
          const inbox = await pollTestmailInbox(tag, since);
          if (inbox.ok === false) {
            if (testmailPollRef.current) window.clearInterval(testmailPollRef.current);
            testmailPollRef.current = null;
            setTestmailProbing(false);
            setNotice({
              tone: "error",
              title: "Testmail poll failed",
              message: "Testmail inbox polling returned an error.",
            });
            load();
            return true;
          }
          if (inbox.received && inbox.email) {
            if (testmailPollRef.current) window.clearInterval(testmailPollRef.current);
            testmailPollRef.current = null;
            setTestmailProbing(false);
            setNotice({
              tone: "success",
              title: "Testmail delivery confirmed",
              message: `Subject: ${inbox.email.subject ?? "(no subject)"} · From: ${inbox.email.from ?? "unknown"}`,
            });
            load();
            return true;
          }
          if (attempts >= 30) {
            if (testmailPollRef.current) window.clearInterval(testmailPollRef.current);
            testmailPollRef.current = null;
            setTestmailProbing(false);
            setNotice({
              tone: "error",
              title: "Testmail timeout",
              message:
                "No welcome email in testmail.app after 90s. Run Sync up to repair transport, or configure RESEND_API_KEY for external delivery.",
            });
            load();
            return true;
          }
        } catch (err: unknown) {
          if (testmailPollRef.current) window.clearInterval(testmailPollRef.current);
          testmailPollRef.current = null;
          setTestmailProbing(false);
          setNotice({
            tone: "error",
            title: "Testmail poll failed",
            message: err instanceof Error ? err.message : "Testmail poll failed",
          });
          return true;
        }
        return false;
      };

      const finished = await poll();
      if (!finished) {
        testmailPollRef.current = window.setInterval(async () => {
          const done = await poll();
          if (done && testmailPollRef.current) {
            window.clearInterval(testmailPollRef.current);
            testmailPollRef.current = null;
          }
        }, 3_000);
      }
    } catch (err: unknown) {
      setTestmailProbing(false);
      setNotice({
        tone: "error",
        title: "Testmail probe failed",
        message: err instanceof Error ? err.message : "Testmail probe failed",
      });
    }
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
          canSendMail ? (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 shadow-[0_8px_24px_rgba(124,92,255,0.25)] transition-opacity"
          >
            <PenLine size={16} /> Compose
          </button>
          ) : null
        }
      />

      {!canSendMail ? (
        <ReadOnlyAclBanner permission="mail.send" feature="Mailbox compose and test send" />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-elevated)_80%,transparent)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">Transport</span>
          {transport ? (
            <>
              <Badge
                variant={
                  !transport.configured
                    ? "danger"
                    : transport.transport === "cloudflare-relay"
                      ? "synced"
                      : transport.transport === "cloudflare-rest"
                        ? "warn"
                        : "synced"
                }
              >
                {transport.configured ? transport.transport : "not configured"}
              </Badge>
              {transport.configured && transport.transport === "cloudflare-rest" && transport.hint && (
                <span className="text-xs text-[var(--color-warn)] max-w-xl">{transport.hint}</span>
              )}
              {!transport.configured && transport.hint && (
                <span className="text-xs text-[var(--color-muted)] max-w-xl">{transport.hint}</span>
              )}
            </>
          ) : (
            <span className="text-sm text-[var(--color-muted)]">Checking…</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canSyncInfra || syncingMail || sending}
            onClick={handleSyncUp}
            title={canSyncInfra ? "Dispatch deploy-infra to repair outbound mail" : "Requires deploy.infra permission"}
            className="inline-flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border border-[var(--color-border)] hover:bg-white/5 disabled:opacity-60 font-medium"
          >
            {syncingMail ? (
              <LorapokLarvaeLoader size="xs" ariaLabel="Syncing mail transport" />
            ) : (
              <CloudUpload size={16} />
            )}
            {syncingMail ? "Syncing…" : "Sync up"}
          </button>
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Test recipient"
            disabled={!canSendMail}
            className={`${inputClass} !w-auto min-w-[12rem] max-w-xs`}
          />
          <button
            type="button"
            disabled={!canSendMail || sending || testmailProbing}
            onClick={handleTest}
            className="inline-flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl bg-[var(--color-accent)] text-white font-medium hover:opacity-90 disabled:opacity-60"
          >
            {sending ? <LorapokLarvaeLoader size="xs" ariaLabel="Sending test email" /> : <Zap size={16} />}
            {sending ? "Sending…" : "Test"}
          </button>
          {testmailProbeEnabled ? (
            <button
              type="button"
              disabled={!canSendMail || sending || testmailProbing}
              onClick={handleTestmailE2E}
              className="inline-flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] text-[var(--color-text)] font-medium hover:bg-white/5 disabled:opacity-60"
            >
              {testmailProbing ? (
                <LorapokLarvaeLoader size="xs" ariaLabel="Running testmail probe" />
              ) : (
                <Sparkles size={16} className="text-[var(--color-accent)]" />
              )}
              {testmailProbing ? "Probing…" : "Testmail E2E"}
            </button>
          ) : null}
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)] gap-6 min-w-0 items-start">
        {/* Left Column: Messages List */}
        <Card className="min-w-0 min-h-[32rem] flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Mail size={18} className="text-[var(--color-accent)]" />
              Message log
            </h3>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-[var(--color-border)] hover:bg-white/5 transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
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
              placeholder="Search…"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)] mb-3">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
            Unread only
          </label>

          <div className="flex-1 min-h-0 rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-y-auto max-h-[30rem] divide-y divide-[var(--color-border)]">
              {items.length === 0 ? (
                <div className="py-12 text-center text-[var(--color-muted)] text-sm">
                  No messages found.
                </div>
              ) : (
                items.map((row) => {
                  const active = selected?.id === row.id;
                  return (
                    <div
                      key={row.id}
                      onClick={() => openMessage(row)}
                      className={`p-3 cursor-pointer transition-colors hover:bg-white/[0.04] ${
                        active
                          ? "bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] border-l-2 border-[var(--color-accent)]"
                          : ""
                      } ${!row.read ? "bg-[color-mix(in_srgb,var(--color-accent)_6%,transparent)] font-medium" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-semibold text-[var(--color-text)] truncate max-w-[180px]">
                          {formatMailboxAddress(row)}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)] shrink-0 font-[family-name:var(--font-mono)]">
                          {new Date(row.ts).toLocaleDateString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text)] font-medium truncate mb-1.5">
                        {row.subject || "(No subject)"}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            row.status === "failed"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {row.status}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-[var(--color-muted)]">
                          {row.category}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-muted)]">
              {total} message(s) · {page}/{totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-[var(--color-border)] disabled:opacity-40 hover:bg-white/5"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </Card>

        {/* Right Column: Full-Width Professional Reading Pane */}
        <div className="min-w-0">
          {selected ? (
            <MailboxMessagePreview
              message={selected}
              onExpand={() => setPreviewExpanded(true)}
            />
          ) : (
            <Card className="flex flex-col items-center justify-center min-h-[32rem] text-center p-8 border-dashed">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-base)] border border-[var(--color-border)] flex items-center justify-center mb-4 text-[var(--color-muted)] shadow-inner">
                <Mail size={32} className="opacity-60" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text)] mb-1">Select an email to view</h3>
              <p className="text-xs text-[var(--color-muted)] max-w-sm mb-6">
                Choose a message from the list on the left to inspect formatted HTML delivery, headers, and transmission logs.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  <PenLine size={14} /> Compose New Email
                </button>
              </div>
            </Card>
          )}
        </div>
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
        <div className="relative">
          <LarvaeLoaderOverlay open={sending} label="Sending message…" />
          <form onSubmit={handleSend} className="space-y-4 max-w-3xl">
          <label className="block text-sm">
            <span className="text-[var(--color-muted)]">Template</span>
            <select
              value={selectedMailTemplate}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedMailTemplate(id);
                const template = mailTemplates.find((t) => t.id === id);
                if (template) {
                  setSubject(template.subject);
                  setBody(template.text);
                  setComposeCategory(template.category ?? "compose");
                }
              }}
              className={`${inputClass} mt-1`}
            >
              <option value="">Choose a template…</option>
              {mailTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
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
            {sending ? <LorapokLarvaeLoader size="xs" ariaLabel="Sending message" /> : <Send size={16} />}
            {sending ? "Sending…" : "Send message"}
          </button>
          </form>
        </div>
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
