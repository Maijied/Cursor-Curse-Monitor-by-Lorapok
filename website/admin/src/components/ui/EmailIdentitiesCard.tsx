import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Plus, RefreshCw, Save, Shield, Trash2 } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import {
  createMailAliasApi,
  deleteMailAliasApi,
  fetchEmailIdentitiesConfigApi,
  provisionEmailIdentityApi,
  putEmailIdentitiesConfigApi,
  syncEmailIdentitiesApi,
  updateMailAliasApi,
  type EmailIdentitiesConfig,
  type EmailIdentityRow,
} from "../../lib/api";
import { useAuthSession } from "../../lib/auth-context";

const CATEGORIES = ["product", "support", "ops", "custom"] as const;
const AUTH_ROLES = ["viewer", "operator", "admin"] as const;

export default function EmailIdentitiesCard() {
  const { hasPermission, isMaster } = useAuthSession();
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
    label: "",
    displayName: "",
    project: "",
    coworkerEmail: "",
    forwardTo: "",
    category: "custom" as (typeof CATEGORIES)[number],
    authAllowed: false,
    authRole: "viewer" as (typeof AUTH_ROLES)[number],
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
      const localPart = provisionForm.localPart.trim();
      const payload = {
        localPart,
        label: provisionForm.label.trim() || provisionForm.displayName.trim() || localPart,
        displayName: provisionForm.displayName.trim() || provisionForm.label.trim() || localPart,
        project: provisionForm.project.trim(),
        coworkerEmail: provisionForm.coworkerEmail.trim(),
        forwardTo: provisionForm.forwardTo.trim() || opsForwardTo,
        category: provisionForm.category,
        authAllowed: provisionForm.authAllowed,
        authRole: provisionForm.authRole,
        dryRun: provisionForm.dryRun,
        provisionRouting: !provisionForm.dryRun,
      };

      const result = isMaster
        ? await createMailAliasApi(payload)
        : await provisionEmailIdentityApi(payload);

      setConfig(result.config);
      const authNote = result.alias?.authAllowed
        ? " Login enabled — alias added to Mission Control allowlist."
        : "";
      setMessage({
        type: "success",
        text: `${result.alias?.fullAddress ?? localPart + "@lorapok.tech"} provisioned.${authNote}`,
      });
      setProvisionForm((prev) => ({
        ...prev,
        localPart: "",
        label: "",
        displayName: "",
        project: "",
        coworkerEmail: "",
        authAllowed: false,
        authRole: "viewer",
        dryRun: false,
      }));
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Provision failed" });
    }
    setProvisioning(false);
  };

  const toggleAuth = async (row: EmailIdentityRow, nextAllowed: boolean) => {
    if (!isMaster) return;
    setMessage(null);
    try {
      const result = await updateMailAliasApi({
        localPart: row.localPart,
        authAllowed: nextAllowed,
        authRole: row.authRole ?? "viewer",
      });
      setConfig(result.config);
      setMessage({
        type: "success",
        text: nextAllowed
          ? `${row.email} can sign in to Mission Control.`
          : `${row.email} removed from login allowlist.`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Auth update failed" });
    }
  };

  const handleDelete = async (row: EmailIdentityRow) => {
    if (!isMaster || row.builtin) return;
    if (!window.confirm(`Delete alias ${row.email}? Cloudflare routing rule is not auto-removed.`)) return;
    try {
      const result = await deleteMailAliasApi(row.localPart);
      setConfig(result.config);
      setMessage({ type: "success", text: `${row.email} deleted.` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Delete failed" });
    }
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
        <LorapokLarvaeLoader label="Loading mail aliases…" />
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
              Mail aliases (@lorapok.tech)
            </h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Real @lorapok.tech addresses for coworkers and projects. Inbound mail forwards via Cloudflare Email
              Routing; outbound uses the alias as From (Resend maps to <code className="text-xs">mail.lorapok.tech</code>).
              Enable <strong>Login</strong> to add the alias to the Mission Control allowlist for Firebase sign-in.
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Also available in <Link to="/dashboard/mailbox" className="text-[var(--color-accent)] underline">Mailbox</Link> compose (From selector).
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
              {syncing ? "Syncing…" : "Sync routing rules"}
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSaveOpsForward} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="ops-forward">
              Default ops forward inbox
            </label>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              New routing rules forward here unless overridden per alias (typically your Gmail ops inbox).
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
                <th className="py-2 pr-3 font-medium">Label / project</th>
                <th className="py-2 pr-3 font-medium">Forward to</th>
                <th className="py-2 pr-3 font-medium">Routing</th>
                <th className="py-2 pr-3 font-medium">Login</th>
                {isMaster ? <th className="py-2 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(config?.identities ?? []).map((row: EmailIdentityRow) => (
                <tr key={row.localPart} className="border-b border-[var(--color-border)]/60">
                  <td className="py-3 pr-3">
                    <div className="font-[family-name:var(--font-mono)] text-xs">{row.email}</div>
                    <div className="text-xs text-[var(--color-muted)]">{row.displayName}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <div>{row.label ?? row.displayName}</div>
                    {row.project ? <div className="text-xs text-[var(--color-muted)]">{row.project}</div> : null}
                    {row.coworkerEmail ? (
                      <div className="text-xs text-[var(--color-muted)] font-[family-name:var(--font-mono)]">
                        coworker: {row.coworkerEmail}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3 font-[family-name:var(--font-mono)] text-xs">{row.forwardTo}</td>
                  <td className="py-3 pr-3">{statusBadge(row.routingStatus)}</td>
                  <td className="py-3 pr-3">
                    {isMaster ? (
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.authAllowed === true}
                          onChange={(e) => void toggleAuth(row, e.target.checked)}
                        />
                        <Shield size={14} aria-hidden="true" />
                        {row.authAllowed ? row.authRole ?? "viewer" : "off"}
                      </label>
                    ) : row.authAllowed ? (
                      <Badge variant="synced">{row.authRole ?? "viewer"}</Badge>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  {isMaster ? (
                    <td className="py-3">
                      {!row.builtin ? (
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Delete
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">built-in</span>
                      )}
                    </td>
                  ) : null}
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
            Create mail alias
          </h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Provisions a real @lorapok.tech address with Cloudflare Email Routing (or KV-only dry run locally).
            {isMaster ? " Master admin can enable Mission Control login for the alias." : ""}
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
              <label className="block text-sm font-medium mb-1" htmlFor="identity-label">Label</label>
              <input
                id="identity-label"
                className={inputClass}
                placeholder="Releases bot"
                value={provisionForm.label}
                onChange={(e) => setProvisionForm((p) => ({ ...p, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-name">Display name (From header)</label>
              <input
                id="identity-name"
                className={inputClass}
                value={provisionForm.displayName}
                onChange={(e) => setProvisionForm((p) => ({ ...p, displayName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-project">Project</label>
              <input
                id="identity-project"
                className={inputClass}
                placeholder="mission-control"
                value={provisionForm.project}
                onChange={(e) => setProvisionForm((p) => ({ ...p, project: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-coworker">Coworker personal email</label>
              <input
                id="identity-coworker"
                type="email"
                className={inputClass}
                placeholder="colleague@gmail.com"
                value={provisionForm.coworkerEmail}
                onChange={(e) => setProvisionForm((p) => ({ ...p, coworkerEmail: e.target.value }))}
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
            {isMaster ? (
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="identity-auth-role">Login role</label>
                <select
                  id="identity-auth-role"
                  className={inputClass}
                  value={provisionForm.authRole}
                  disabled={!provisionForm.authAllowed}
                  onChange={(e) =>
                    setProvisionForm((p) => ({
                      ...p,
                      authRole: e.target.value as (typeof AUTH_ROLES)[number],
                    }))
                  }
                >
                  {AUTH_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={provisionForm.dryRun}
                  onChange={(e) => setProvisionForm((p) => ({ ...p, dryRun: e.target.checked }))}
                />
                Dry run (KV only, no Cloudflare API)
              </label>
              {isMaster ? (
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={provisionForm.authAllowed}
                    onChange={(e) => setProvisionForm((p) => ({ ...p, authAllowed: e.target.checked }))}
                  />
                  <Shield size={14} aria-hidden="true" />
                  Allow Mission Control login
                </label>
              ) : null}
              <button
                type="submit"
                disabled={provisioning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
              >
                {provisioning ? "Creating…" : "Create alias"}
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
