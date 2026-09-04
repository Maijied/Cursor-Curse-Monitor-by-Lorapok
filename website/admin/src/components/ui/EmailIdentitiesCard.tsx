import { useEffect, useState } from "react";
import { Mail, Plus, RefreshCw, Save } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import {
  fetchEmailIdentitiesConfigApi,
  provisionEmailIdentityApi,
  putEmailIdentitiesConfigApi,
  syncEmailIdentitiesApi,
  type EmailIdentitiesConfig,
  type EmailIdentityRow,
} from "../../lib/api";
import { useAuthSession } from "../../lib/auth-context";

const CATEGORIES = ["product", "support", "ops", "custom"] as const;

export default function EmailIdentitiesCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("settings.write");
  const canProvision = hasPermission("mail.provision");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<EmailIdentitiesConfig | null>(null);
  const [opsForwardTo, setOpsForwardTo] = useState("");
  const [provisionForm, setProvisionForm] = useState({
    localPart: "",
    displayName: "",
    forwardTo: "",
    category: "custom" as (typeof CATEGORIES)[number],
    dryRun: false,
  });

  useEffect(() => {
    fetchEmailIdentitiesConfigApi()
      .then((data) => {
        setConfig(data.config);
        setOpsForwardTo(data.config.opsForwardTo);
        setProvisionForm((prev) => ({
          ...prev,
          forwardTo: data.config.opsForwardTo,
        }));
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const handleSaveOpsForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await putEmailIdentitiesConfigApi({ opsForwardTo });
      setConfig(result.config);
      setMessage({ type: "success", text: "Default forward address saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleSyncAll = async () => {
    if (!canProvision) return;
    setSyncing(true);
    setMessage(null);
    try {
      const result = await syncEmailIdentitiesApi();
      setConfig(result.config);
      const { provisioned, reused, failed } = result.summary;
      setMessage({
        type: failed > 0 ? "error" : "success",
        text: `Sync complete — ${provisioned} created, ${reused} reused, ${failed} failed.`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Sync failed" });
    }
    setSyncing(false);
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProvision) return;
    setProvisioning(true);
    setMessage(null);
    try {
      const result = await provisionEmailIdentityApi({
        localPart: provisionForm.localPart.trim(),
        displayName: provisionForm.displayName.trim() || provisionForm.localPart.trim(),
        forwardTo: provisionForm.forwardTo.trim() || opsForwardTo,
        category: provisionForm.category,
        dryRun: provisionForm.dryRun,
      });
      setConfig(result.config);
      setMessage({
        type: "success",
        text: result.provision?.message ?? "Identity provisioned.",
      });
      setProvisionForm((prev) => ({
        ...prev,
        localPart: "",
        displayName: "",
        dryRun: false,
      }));
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Provision failed" });
    }
    setProvisioning(false);
  };

  const statusBadge = (status: string) => {
    if (status === "provisioned" || status === "builtin") {
      return <Badge variant="synced">{status}</Badge>;
    }
    if (status === "simulated") {
      return <Badge variant="warn">simulated</Badge>;
    }
    if (status === "error") {
      return <Badge variant="danger">error</Badge>;
    }
    return <Badge variant="neutral">{status}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <LorapokLarvaeLoader label="Loading email identities…" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Mail size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
              Email identities
            </h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Lorapok @lorapok.tech addresses and Cloudflare Email Routing forward rules. Outbound Resend uses{" "}
              <code className="text-xs">mail.lorapok.tech</code> separately.
            </p>
          </div>
          {config?.updatedAt ? (
            <p className="text-xs text-[var(--color-muted)]">
              Updated {new Date(config.updatedAt).toLocaleString()}
              {config.updatedBy ? ` by ${config.updatedBy}` : ""}
            </p>
          ) : null}
          {canProvision ? (
            <button
              type="button"
              onClick={() => void handleSyncAll()}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync all identities"}
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSaveOpsForward} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="ops-forward">
              Default ops forward inbox
            </label>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              New routing rules forward here unless overridden per identity (typically your Gmail ops inbox).
            </p>
            <input
              id="ops-forward"
              type="email"
              className={inputClass}
              value={opsForwardTo}
              onChange={(e) => setOpsForwardTo(e.target.value)}
              disabled={!canWrite}
              required
            />
          </div>
          {canWrite ? (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save default forward"}
            </button>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">Read-only — settings.write required to edit.</p>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-3 font-medium">Address</th>
                <th className="py-2 pr-3 font-medium">Display name</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Forward to</th>
                <th className="py-2 font-medium">Routing</th>
              </tr>
            </thead>
            <tbody>
              {(config?.identities ?? []).map((row: EmailIdentityRow) => (
                <tr key={row.localPart} className="border-b border-[var(--color-border)]/60">
                  <td className="py-3 pr-3 font-[family-name:var(--font-mono)] text-xs">{row.email}</td>
                  <td className="py-3 pr-3">{row.displayName}</td>
                  <td className="py-3 pr-3 capitalize">{row.category}</td>
                  <td className="py-3 pr-3 font-[family-name:var(--font-mono)] text-xs">{row.forwardTo}</td>
                  <td className="py-3">{statusBadge(row.routingStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canProvision ? (
        <Card>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Plus size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Provision routing rule
          </h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Creates a Cloudflare Email Routing forward rule for a new @lorapok.tech address. Requires{" "}
            <code className="text-xs">mail.provision</code> (master).
          </p>
          <form onSubmit={handleProvision} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-local">Local part</label>
              <input
                id="identity-local"
                className={inputClass}
                placeholder="releases"
                value={provisionForm.localPart}
                onChange={(e) => setProvisionForm((p) => ({ ...p, localPart: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-name">Display name</label>
              <input
                id="identity-name"
                className={inputClass}
                value={provisionForm.displayName}
                onChange={(e) => setProvisionForm((p) => ({ ...p, displayName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-forward">Forward to</label>
              <input
                id="identity-forward"
                type="email"
                className={inputClass}
                value={provisionForm.forwardTo}
                onChange={(e) => setProvisionForm((p) => ({ ...p, forwardTo: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-category">Category</label>
              <select
                id="identity-category"
                className={inputClass}
                value={provisionForm.category}
                onChange={(e) =>
                  setProvisionForm((p) => ({
                    ...p,
                    category: e.target.value as (typeof CATEGORIES)[number],
                  }))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={provisionForm.dryRun}
                  onChange={(e) => setProvisionForm((p) => ({ ...p, dryRun: e.target.checked }))}
                />
                Dry run (KV only, no Cloudflare API)
              </label>
              <button
                type="submit"
                disabled={provisioning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
              >
                {provisioning ? "Provisioning…" : "Provision identity"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {message ? (
        <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} onDismiss={() => setMessage(null)} />
      ) : null}
    </div>
  );
}
