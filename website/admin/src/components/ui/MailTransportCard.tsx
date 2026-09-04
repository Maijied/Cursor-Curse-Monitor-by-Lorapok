import { useCallback, useEffect, useState } from "react";
import { BookOpen, CloudUpload, ExternalLink, Mail, Save } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { auth } from "../../lib/firebase";
import { useIntervalRefresh } from "../../hooks/useIntervalRefresh";
import {
  fetchMailTransportConfigApi,
  putMailTransportConfigApi,
  syncMailTransport,
  type MailSetupInstructions,
  type MailTransportConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

const RESEND_GUIDE_URL =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/docs/guides/RESEND_WORKERS_FREE_SETUP.md";

function MailInstructionsPanel({ instructions }: { instructions: MailSetupInstructions }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)]/40 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-medium flex items-center gap-2 text-sm">
            <BookOpen size={16} className="text-[var(--color-accent)]" aria-hidden="true" />
            Resend setup instructions
          </h4>
          <p className="text-xs text-[var(--color-muted)] mt-1">{instructions.summary}</p>
        </div>
        <a
          href={RESEND_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-accent-2)] hover:underline"
        >
          Full guide <ExternalLink size={12} />
        </a>
      </div>
      <ol className="space-y-3 text-sm">
        {instructions.steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <Badge variant={step.done ? "synced" : "warn"}>{step.done ? "Done" : `${index + 1}`}</Badge>
            <div className="min-w-0">
              <p className="font-medium">{step.title}</p>
              <p className="text-[var(--color-muted)] text-xs mt-0.5">{step.description}</p>
              {step.command ? (
                <code className="block mt-2 text-[10px] p-2 rounded-lg bg-black/30 overflow-x-auto font-[family-name:var(--font-mono)]">
                  {step.command}
                </code>
              ) : null}
              {step.link ? (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-xs text-[var(--color-accent-2)] hover:underline"
                >
                  Open <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-[var(--color-warn)]">{instructions.secretsNote}</p>
    </div>
  );
}

/**
 * Configure outbound mail identities, Resend/Workers Free routing, and view transport secret status.
 */
export default function MailTransportCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<MailTransportConfig | null>(null);
  const [instructions, setInstructions] = useState<MailSetupInstructions | null>(null);
  const [form, setForm] = useState({
    productEmail: "",
    supportEmail: "",
    opsBccEmail: "",
    productFromName: "",
    supportFromName: "",
    resendFirstExternal: true,
    workersFreeMode: true,
    sendingDomain: "lorapok.tech",
    resendFromOverride: "",
    resendDomainVerified: false,
  });

  const load = useCallback(() => {
    setLoading(true);
    fetchMailTransportConfigApi()
      .then((data) => {
        setConfig(data.config);
        setInstructions(data.setupInstructions);
        setForm({
          productEmail: data.config.productEmail,
          supportEmail: data.config.supportEmail,
          opsBccEmail: data.config.opsBccEmail,
          productFromName: data.config.productFromName,
          supportFromName: data.config.supportFromName,
          resendFirstExternal: data.config.resendFirstExternal,
          workersFreeMode: data.config.workersFreeMode,
          sendingDomain: data.config.sendingDomain,
          resendFromOverride: data.config.resendFromOverride,
          resendDomainVerified: data.config.resendDomainVerified,
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
      setInstructions(result.setupInstructions);
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
      const res = await syncMailTransport();
      setMessage({
        type: res.ok ? "success" : "error",
        text: res.message ?? (res.ok ? "Mail sync dispatched." : "Mail sync failed."),
      });
      load();
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
            Workers Free subscriber mail uses Resend. Configure routing and domain preferences here; API keys stay in
            Pages secrets.
          </p>
        </div>
        {config && (
          <Badge variant={config.transportConfigured ? "synced" : "warn"}>
            {config.transportConfigured ? config.transport : "Not configured"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading mail settings" className="!flex-row !gap-3" />
          <span>Loading mail settings…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {instructions && <MailInstructionsPanel instructions={instructions} />}

          {config && (
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              {[
                ["Resend API key (Pages)", config.resendConfigured],
                ["RESEND_FROM (Pages)", config.resendFromEnvConfigured],
                ["MAIL_RELAY bound", config.relayBound],
                ["Cloudflare REST", config.restConfigured],
                ["Testmail (E2E)", config.testmailConfigured],
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
                <label htmlFor="mail-sending-domain" className="block text-sm font-medium mb-2">
                  Resend sending domain
                </label>
                <input
                  id="mail-sending-domain"
                  type="text"
                  value={form.sendingDomain}
                  onChange={(e) => setForm((p) => ({ ...p, sendingDomain: e.target.value }))}
                  disabled={!isMaster}
                  className={inputClass}
                  placeholder="lorapok.tech"
                />
                <FieldHelp label="Sending domain" className="mt-2">
                  Must match DNS verified in Resend. Outbound mail uses this domain for From addresses.
                </FieldHelp>
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
              <div className="sm:col-span-2">
                <label htmlFor="mail-resend-from" className="block text-sm font-medium mb-2">
                  Resend From override (optional)
                </label>
                <input
                  id="mail-resend-from"
                  type="text"
                  value={form.resendFromOverride}
                  onChange={(e) => setForm((p) => ({ ...p, resendFromOverride: e.target.value }))}
                  disabled={!isMaster}
                  className={inputClass}
                  placeholder='Cursor Curse Monitor <cursor.monitor@lorapok.tech>'
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Used when the RESEND_FROM Pages secret is empty. Pages secret always wins when set.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.workersFreeMode}
                  onChange={(e) => setForm((p) => ({ ...p, workersFreeMode: e.target.checked }))}
                  disabled={!isMaster}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium block">Workers Free mode</span>
                  <span className="text-[var(--color-muted)]">
                    Use Resend for external subscribers when RESEND_API_KEY is configured (recommended on Free plan).
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.resendFirstExternal}
                  onChange={(e) => setForm((p) => ({ ...p, resendFirstExternal: e.target.checked }))}
                  disabled={!isMaster}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium block">Resend-first for external recipients</span>
                  <span className="text-[var(--color-muted)]">
                    Route Gmail and testmail.app through Resend before Cloudflare relay.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.resendDomainVerified}
                  onChange={(e) => setForm((p) => ({ ...p, resendDomainVerified: e.target.checked }))}
                  disabled={!isMaster}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium block">Resend domain verified</span>
                  <span className="text-[var(--color-muted)]">
                    Enable after SPF/DKIM DNS for {form.sendingDomain} shows verified in Resend.
                  </span>
                </span>
              </label>
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
