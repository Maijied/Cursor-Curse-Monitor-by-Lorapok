import { useEffect, useState } from "react";
import { ExternalLink, Mail, Save } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { auth } from "../../lib/firebase";
import { fetchResendConfigApi, putResendConfigApi, type ResendIntegrationConfig } from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

const RESEND_GUIDE_URL =
  "https://github.com/Maijied/Cursor-Curse-Monitor-by-Lorapok/blob/main/docs/guides/RESEND_WORKERS_FREE_SETUP.md";

export default function ResendConfigCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<ResendIntegrationConfig | null>(null);
  const [form, setForm] = useState({
    sendingDomain: "lorapok.tech",
    resendFromOverride: "",
    resendFrom: "",
    resendApiKey: "",
    resendFirstExternal: true,
    workersFreeMode: true,
    resendDomainVerified: false,
  });

  useEffect(() => {
    fetchResendConfigApi()
      .then((data) => {
        setConfig(data.config);
        setForm({
          sendingDomain: data.config.sendingDomain,
          resendFromOverride: data.config.resendFromOverride,
          resendFrom: "",
          resendApiKey: "",
          resendFirstExternal: data.config.resendFirstExternal,
          workersFreeMode: data.config.workersFreeMode,
          resendDomainVerified: data.config.resendDomainVerified,
        });
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMaster) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string | boolean> = {
        sendingDomain: form.sendingDomain.trim(),
        resendFromOverride: form.resendFromOverride.trim(),
        resendFirstExternal: form.resendFirstExternal,
        workersFreeMode: form.workersFreeMode,
        resendDomainVerified: form.resendDomainVerified,
      };
      if (form.resendApiKey.trim()) payload.resendApiKey = form.resendApiKey.trim();
      if (form.resendFrom.trim()) payload.resendFrom = form.resendFrom.trim();

      const result = await putResendConfigApi(payload);
      setConfig(result.config);
      setForm((prev) => ({ ...prev, resendApiKey: "", resendFrom: "" }));
      const syncNote = result.githubSyncWarning
        ? ` ${result.githubSyncWarning}`
        : result.githubSecretsSyncedAt
          ? " GitHub secrets updated."
          : "";
      setMessage({
        type: result.githubSyncWarning ? "error" : "success",
        text: `Resend settings saved.${syncNote}`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const configured = config?.resendApiKeyConfigured;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Mail size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Resend
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Workers Free external mail (Gmail, testmail.app). Secrets sync to GitHub{" "}
            <code className="text-xs">admin-production</code>; Pages picks them up on deploy-infra.
          </p>
          <a
            href={RESEND_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--color-accent-2)] hover:underline"
          >
            Setup guide <ExternalLink size={12} />
          </a>
        </div>
        {config && (
          <Badge variant={configured ? "synced" : "warn"}>{configured ? "API key on server" : "Missing API key"}</Badge>
        )}
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading Resend settings…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {config && (
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              {[
                ["RESEND_API_KEY", config.resendApiKeyConfigured],
                ["RESEND_FROM (Pages)", config.resendFromConfigured],
                ["Effective From", Boolean(config.resendFromEffective)],
              ].map(([label, ok]) => (
                <div
                  key={String(label)}
                  className="flex justify-between items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
                >
                  <dt className="text-[var(--color-muted)]">{label}</dt>
                  <dd>
                    <Badge variant={ok ? "synced" : "warn"}>{ok ? "OK" : "Missing"}</Badge>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="resend-domain" className="block text-sm font-medium mb-1.5">Sending domain</label>
              <input
                id="resend-domain"
                className={inputClass}
                value={form.sendingDomain}
                onChange={(e) => setForm((p) => ({ ...p, sendingDomain: e.target.value }))}
                disabled={!isMaster}
              />
            </div>
            <div>
              <label htmlFor="resend-from-override" className="block text-sm font-medium mb-1.5">
                From override (KV)
              </label>
              <input
                id="resend-from-override"
                className={inputClass}
                value={form.resendFromOverride}
                onChange={(e) => setForm((p) => ({ ...p, resendFromOverride: e.target.value }))}
                disabled={!isMaster}
                placeholder="Name &lt;user@lorapok.tech&gt;"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] space-y-4">
            <p className="text-sm font-medium">Rotate GitHub / Pages secrets</p>
            <div>
              <label htmlFor="resend-api-key" className="block text-sm font-medium mb-1.5">
                RESEND_API_KEY
                {config?.resendApiKeyConfigured ? (
                  <Badge variant="synced" className="ml-2 !text-[10px]">on server</Badge>
                ) : null}
              </label>
              <input
                id="resend-api-key"
                type="password"
                autoComplete="off"
                className={inputClass}
                value={form.resendApiKey}
                onChange={(e) => setForm((p) => ({ ...p, resendApiKey: e.target.value }))}
                disabled={!isMaster}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div>
              <label htmlFor="resend-from-secret" className="block text-sm font-medium mb-1.5">
                RESEND_FROM (Pages secret)
                {config?.resendFromConfigured ? (
                  <Badge variant="synced" className="ml-2 !text-[10px]">on server</Badge>
                ) : null}
              </label>
              <input
                id="resend-from-secret"
                type="text"
                autoComplete="off"
                className={inputClass}
                value={form.resendFrom}
                onChange={(e) => setForm((p) => ({ ...p, resendFrom: e.target.value }))}
                disabled={!isMaster}
                placeholder="cursor-contact@lorapok.tech"
              />
            </div>
            <FieldHelp label="Cred vault">
              Local: <code className="text-xs">cred set cursor resend_api_key</code> then{" "}
              <code className="text-xs">node website/admin/scripts/sync-cred-vault-github.mjs</code>
            </FieldHelp>
          </div>

          <div className="space-y-3">
            {[
              {
                key: "workersFreeMode" as const,
                title: "Workers Free mode",
                detail: "Use Resend for external subscribers when RESEND_API_KEY is set.",
              },
              {
                key: "resendFirstExternal" as const,
                title: "Resend-first for external recipients",
                detail: "Route Gmail and testmail.app through Resend before Cloudflare relay.",
              },
              {
                key: "resendDomainVerified" as const,
                title: "Resend domain verified",
                detail: `Enable after SPF/DKIM for ${form.sendingDomain} shows verified in Resend.`,
              },
            ].map((item) => (
              <label key={item.key} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form[item.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [item.key]: e.target.checked }))}
                  disabled={!isMaster}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium block">{item.title}</span>
                  <span className="text-[var(--color-muted)]">{item.detail}</span>
                </span>
              </label>
            ))}
          </div>

          {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

          {isMaster && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-contrast,#0f172a)] font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save & sync secrets"}
            </button>
          )}
        </form>
      )}
    </Card>
  );
}
