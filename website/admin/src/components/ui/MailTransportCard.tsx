import { useCallback, useEffect, useState } from "react";
import { CloudUpload, Mail, Save } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import MailSyncProgressBanner from "./MailSyncProgressBanner";
import { auth } from "../../lib/firebase";
import { useIntervalRefresh } from "../../hooks/useIntervalRefresh";
import { useWorkflowPoll } from "../../hooks/useWorkflowPoll";
import {
  fetchMailTransportConfigApi,
  putMailTransportConfigApi,
  syncMailTransport,
  type MailTransportConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Configure Cloudflare outbound mail identities and relay sync.
 */
export default function MailTransportCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const mailWorkflowPoll = useWorkflowPoll();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<MailTransportConfig | null>(null);
  const [form, setForm] = useState({
    productEmail: "",
    supportEmail: "",
    opsBccEmail: "",
    productFromName: "",
    supportFromName: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    fetchMailTransportConfigApi()
      .then((data) => {
        setConfig(data.config);
        setForm({
          productEmail: data.config.productEmail,
          supportEmail: data.config.supportEmail,
          opsBccEmail: data.config.opsBccEmail,
          productFromName: data.config.productFromName,
          supportFromName: data.config.supportFromName,
        });
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useIntervalRefresh(load, 60_000);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putMailTransportConfigApi(form);
      setConfig(result.config);
      setMessage({ type: "success", text: "Mail settings saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleSync = async () => {
    if (!isMaster) return;
    setSyncing(true);
    setMessage(null);
    try {
      const dispatchedAt = Date.now();
      const res = await syncMailTransport();
      if (res.ok) {
        mailWorkflowPoll.startPoll({
          workflowName: res.workflow ?? "ci-cd.yml",
          dispatchedAfter: dispatchedAt,
          onComplete: () => load(),
        });
        setMessage({
          type: "success",
          text: res.message ?? "Mail sync dispatched — tracking GitHub Actions…",
        });
      } else {
        setMessage({
          type: "error",
          text: res.message ?? "Mail sync failed.",
        });
        load();
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Sync failed" });
    }
    setSyncing(false);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Mail size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Outbound mail
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Cloudflare Email identities and relay worker sync. Resend and testmail have dedicated Settings tabs.
          </p>
        </div>
        {config && (
          <Badge variant={config.transportConfigured ? "synced" : "warn"}>
            {config.transportConfigured ? config.transport : "Not configured"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      <MailSyncProgressBanner
        status={mailWorkflowPoll.status}
        run={mailWorkflowPoll.run}
        pollError={mailWorkflowPoll.pollError}
        onDismiss={mailWorkflowPoll.dismiss}
      />

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading mail settings" className="!flex-row !gap-3" />
          <span>Loading mail settings…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {config && (
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              {[
                ["MAIL_RELAY bound", config.relayBound],
                ["Cloudflare REST", config.restConfigured],
              ].map(([label, ok]) => (
                <div
                  key={String(label)}
                  className="flex justify-between items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
                >
                  <dt className="text-[var(--color-muted)]">{label}</dt>
                  <dd>
                    <Badge variant={ok ? "synced" : "warn"}>{ok ? "Configured" : "Missing"}</Badge>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mail-product-email" className="block text-sm font-medium mb-2">
                  Product From email
                </label>
                <input
                  id="mail-product-email"
                  type="email"
                  value={form.productEmail}
                  onChange={(e) => setForm((p) => ({ ...p, productEmail: e.target.value }))}
                  disabled={!isMaster}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="mail-support-email" className="block text-sm font-medium mb-2">
                  Support From email
                </label>
                <input
                  id="mail-support-email"
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => setForm((p) => ({ ...p, supportEmail: e.target.value }))}
                  disabled={!isMaster}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="mail-ops-bcc" className="block text-sm font-medium mb-2">
                  Ops BCC copy
                </label>
                <input
                  id="mail-ops-bcc"
                  type="email"
                  value={form.opsBccEmail}
                  onChange={(e) => setForm((p) => ({ ...p, opsBccEmail: e.target.value }))}
                  disabled={!isMaster}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="mail-product-name" className="block text-sm font-medium mb-2">
                  Product display name
                </label>
                <input
                  id="mail-product-name"
                  type="text"
                  value={form.productFromName}
                  onChange={(e) => setForm((p) => ({ ...p, productFromName: e.target.value }))}
                  disabled={!isMaster}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="mail-support-name" className="block text-sm font-medium mb-2">
                  Support display name
                </label>
                <input
                  id="mail-support-name"
                  type="text"
                  value={form.supportFromName}
                  onChange={(e) => setForm((p) => ({ ...p, supportFromName: e.target.value }))}
                  disabled={!isMaster}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!isMaster || saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
              >
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving…" : "Save mail settings"}
              </button>
              <button
                type="button"
                disabled={!isMaster || syncing}
                onClick={handleSync}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5 disabled:opacity-50"
              >
                <CloudUpload size={16} aria-hidden="true" />
                {syncing ? "Syncing…" : "Sync up"}
              </button>
              <Link
                to="/mailbox"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] font-medium hover:bg-white/5 text-sm"
              >
                Open Mailbox
              </Link>
            </div>
            {!isMaster && <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>}
          </form>
        </div>
      )}
    </Card>
  );
}
