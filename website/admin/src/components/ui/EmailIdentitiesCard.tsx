import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Pencil, Plus, RefreshCw, Save, Send, Shield, Trash2 } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import Modal from "./Modal";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import {
  createMailAliasApi,
  deleteMailAliasApi,
  fetchEmailIdentitiesConfigApi,
  fetchMailSetupStatusApi,
  provisionEmailIdentityApi,
  putEmailIdentitiesConfigApi,
  sendMailboxTest,
  syncEmailIdentitiesApi,
  updateMailAliasApi,
  type EmailIdentitiesConfig,
  type EmailIdentityRow,
} from "../../lib/api";
import { useAuthSession } from "../../lib/auth-context";

const CATEGORIES = ["product", "support", "ops", "custom"] as const;
const AUTH_ROLES = ["viewer", "operator", "admin"] as const;

type IdentityTestResult = {
  ok: boolean;
  message: string;
  transport?: string;
  testedAt: string;
};

type EditForm = {
  localPart: string;
  label: string;
  displayName: string;
  project: string;
  coworkerEmail: string;
  forwardTo: string;
  category: (typeof CATEGORIES)[number];
  enabled: boolean;
  authAllowed: boolean;
  authRole: (typeof AUTH_ROLES)[number];
};

export default function EmailIdentitiesCard() {
  const { hasPermission, isMaster, user } = useAuthSession();
  const canWrite = hasPermission("settings.write");
  const canProvision = hasPermission("mail.provision");
  const canSendTest = hasPermission("mail.send");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testingLocalPart, setTestingLocalPart] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<EmailIdentitiesConfig | null>(null);
  const [opsForwardTo, setOpsForwardTo] = useState("");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, IdentityTestResult>>({});
  const [editing, setEditing] = useState<EmailIdentityRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(true);
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

  const testRecipient = useMemo(() => {
    const candidates = [
      redirectTo,
      opsForwardTo,
      user?.email?.toLowerCase(),
    ].filter(Boolean) as string[];
    return candidates[0] ?? "";
  }, [redirectTo, opsForwardTo, user?.email]);

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

    fetchMailSetupStatusApi()
      .then((data) => setRedirectTo(data.redirect?.address ?? null))
      .catch(() => setRedirectTo(null));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const identityAddress = (row: EmailIdentityRow) => row.fullAddress ?? row.email;

  const openEdit = (row: EmailIdentityRow) => {
    setEditing(row);
    setEditForm({
      localPart: row.localPart,
      label: row.label ?? row.displayName,
      displayName: row.displayName,
      project: row.project ?? "",
      coworkerEmail: row.coworkerEmail ?? "",
      forwardTo: row.forwardTo,
      category: (CATEGORIES.includes(row.category as (typeof CATEGORIES)[number])
        ? row.category
        : "custom") as (typeof CATEGORIES)[number],
      enabled: row.enabled !== false,
      authAllowed: row.authAllowed === true,
      authRole: (AUTH_ROLES.includes((row.authRole ?? "viewer") as (typeof AUTH_ROLES)[number])
        ? row.authRole
        : "viewer") as (typeof AUTH_ROLES)[number],
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(null);
  };

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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        localPart: editForm.localPart,
        label: editForm.label.trim() || editForm.displayName.trim() || editForm.localPart,
        displayName: editForm.displayName.trim() || editForm.label.trim() || editForm.localPart,
        project: editForm.project.trim(),
        coworkerEmail: editForm.coworkerEmail.trim(),
        forwardTo: editForm.forwardTo.trim(),
        category: editForm.category,
        enabled: editForm.enabled,
        authAllowed: editForm.authAllowed,
        authRole: editForm.authRole,
      };

      const result = isMaster
        ? await updateMailAliasApi(payload)
        : await putEmailIdentitiesConfigApi({ identities: [payload] });

      setConfig(result.config);
      setMessage({ type: "success", text: `${identityAddress(editing!)} updated.` });
      closeEdit();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Update failed" });
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
      const fullAddress = result.alias?.fullAddress ?? `${localPart}@lorapok.tech`;
      const authNote = result.alias?.authAllowed
        ? " Login enabled — alias added to Mission Control allowlist."
        : "";
      setMessage({
        type: "success",
        text: `${fullAddress} provisioned.${authNote}`,
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

  const handleTestSend = async (row: EmailIdentityRow) => {
    if (!canSendTest) return;
    const to = testRecipient;
    if (!to) {
      setMessage({ type: "error", text: "Set a redirect target, ops forward inbox, or sign in with an email." });
      return;
    }
    setTestingLocalPart(row.localPart);
    setMessage(null);
    try {
      const result = await sendMailboxTest(to, row.localPart);
      const testedAt = new Date().toISOString();
      setTestResults((prev) => ({
        ...prev,
        [row.localPart]: {
          ok: result.ok,
          message: result.message ?? (result.ok ? `Sent to ${to}` : "Send failed"),
          transport: result.transport,
          testedAt,
        },
      }));
      setMessage({
        type: result.ok ? "success" : "error",
        text: result.message ?? (result.ok ? `Test sent from ${identityAddress(row)}` : "Test send failed"),
      });
    } catch (err: unknown) {
      const testedAt = new Date().toISOString();
      const text = err instanceof Error ? err.message : "Test send failed";
      setTestResults((prev) => ({
        ...prev,
        [row.localPart]: { ok: false, message: text, testedAt },
      }));
      setMessage({ type: "error", text });
    }
    setTestingLocalPart(null);
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
          ? `${identityAddress(row)} can sign in to Mission Control.`
          : `${identityAddress(row)} removed from login allowlist.`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Auth update failed" });
    }
  };

  const handleDelete = async (row: EmailIdentityRow) => {
    if (!isMaster || row.builtin) return;
    if (!window.confirm(`Delete alias ${identityAddress(row)}? Cloudflare routing rule is not auto-removed.`)) return;
    try {
      const result = await deleteMailAliasApi(row.localPart);
      setConfig(result.config);
      setMessage({ type: "success", text: `${identityAddress(row)} deleted.` });
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
              Email identities (@lorapok.tech)
            </h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Real @lorapok.tech addresses for product, support, ops, and custom aliases. Edit metadata, test outbound
              send per identity, and provision inbound routing. Enable <strong>Login</strong> to add an alias to the
              Mission Control allowlist.
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Compose uses these in{" "}
              <Link to="/dashboard/mailbox" className="text-[var(--color-accent)] underline">Mailbox</Link> (From selector).
              {testRecipient ? (
                <> Test sends deliver to <span className="font-[family-name:var(--font-mono)]">{testRecipient}</span>.</>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canProvision ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium"
                >
                  <Plus size={16} aria-hidden="true" />
                  Generate email
                </button>
                <button
                  type="button"
                  onClick={() => void handleSyncAll()}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-white/5 disabled:opacity-50"
                >
                  <RefreshCw size={16} aria-hidden="true" className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Syncing…" : "Sync routing"}
                </button>
              </>
            ) : null}
            {config?.updatedAt ? (
              <p className="text-xs text-[var(--color-muted)] w-full sm:w-auto">
                Updated {new Date(config.updatedAt).toLocaleString()}
                {config.updatedBy ? ` by ${config.updatedBy}` : ""}
              </p>
            ) : null}
          </div>
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
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Forward to</th>
                <th className="py-2 pr-3 font-medium">Routing</th>
                <th className="py-2 pr-3 font-medium">Login</th>
                <th className="py-2 pr-3 font-medium">Test</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(config?.identities ?? []).map((row: EmailIdentityRow) => {
                const address = identityAddress(row);
                const lastTest = testResults[row.localPart];
                return (
                  <tr key={row.localPart} className="border-b border-[var(--color-border)]/60 align-top">
                    <td className="py-3 pr-3">
                      <div className="font-[family-name:var(--font-mono)] text-xs">{address}</div>
                      <div className="text-xs text-[var(--color-muted)]">{row.displayName}</div>
                      {row.enabled === false ? <Badge variant="warn">disabled</Badge> : null}
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
                    <td className="py-3 pr-3">
                      <Badge variant="neutral">{row.category}</Badge>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-[family-name:var(--font-mono)] text-xs">{row.forwardTo}</div>
                      {row.forwardTo ? (
                        <p className="text-xs text-[var(--color-muted)] mt-1">
                          Receive: mail to {address} forwards here. Use Sync routing if inbound is not provisioned.
                        </p>
                      ) : null}
                    </td>
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
                    <td className="py-3 pr-3">
                      {canSendTest ? (
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => void handleTestSend(row)}
                            disabled={testingLocalPart === row.localPart}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-[var(--color-border)] hover:bg-white/5 disabled:opacity-50"
                          >
                            <Send size={12} aria-hidden="true" />
                            {testingLocalPart === row.localPart ? "Sending…" : "Test send"}
                          </button>
                          {lastTest ? (
                            <p className={`text-xs ${lastTest.ok ? "text-emerald-400" : "text-red-400"}`}>
                              {lastTest.ok ? "OK" : "Failed"}
                              {lastTest.transport ? ` via ${lastTest.transport}` : ""}
                              <span className="block text-[var(--color-muted)]">
                                {new Date(lastTest.testedAt).toLocaleString()}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">mail.send</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                          >
                            <Pencil size={12} aria-hidden="true" />
                            Edit
                          </button>
                        ) : null}
                        {isMaster && !row.builtin ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(row)}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        ) : row.builtin ? (
                          <span className="text-xs text-[var(--color-muted)]">built-in</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {canProvision && showCreateForm ? (
        <Card id="create-mail-alias">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Plus size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Generate email
          </h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Creates a real @lorapok.tech address with Cloudflare Email Routing (or KV-only dry run locally).
            Local part: lowercase letters, numbers, dots, and hyphens.
            {isMaster ? " Master admin can enable Mission Control login for the alias." : ""}
          </p>
          <form onSubmit={handleProvision} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="identity-local">Local part</label>
              <input
                id="identity-local"
                className={inputClass}
                placeholder="releases"
                pattern="[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?"
                title="Lowercase letters, numbers, dots, and hyphens"
                value={provisionForm.localPart}
                onChange={(e) => setProvisionForm((p) => ({ ...p, localPart: e.target.value.toLowerCase() }))}
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

      <Modal
        open={Boolean(editing && editForm)}
        onClose={closeEdit}
        title={editing ? `Edit ${identityAddress(editing)}` : "Edit identity"}
        subtitle="Updates KV identity metadata. Use Sync routing to reprovision Cloudflare inbound rules after forward target changes."
        footer={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={closeEdit}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-identity-form"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        }
      >
        {editForm ? (
          <form id="edit-identity-form" onSubmit={handleSaveEdit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-[family-name:var(--font-mono)]">{editForm.localPart}@{config?.domain ?? "lorapok.tech"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="edit-label">Label</label>
              <input
                id="edit-label"
                className={inputClass}
                value={editForm.label}
                onChange={(e) => setEditForm((p) => (p ? { ...p, label: e.target.value } : p))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="edit-display">Display name</label>
              <input
                id="edit-display"
                className={inputClass}
                value={editForm.displayName}
                onChange={(e) => setEditForm((p) => (p ? { ...p, displayName: e.target.value } : p))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="edit-project">Project</label>
              <input
                id="edit-project"
                className={inputClass}
                value={editForm.project}
                onChange={(e) => setEditForm((p) => (p ? { ...p, project: e.target.value } : p))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="edit-coworker">Coworker email</label>
              <input
                id="edit-coworker"
                type="email"
                className={inputClass}
                value={editForm.coworkerEmail}
                onChange={(e) => setEditForm((p) => (p ? { ...p, coworkerEmail: e.target.value } : p))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="edit-forward">Forward to</label>
              <input
                id="edit-forward"
                type="email"
                className={inputClass}
                value={editForm.forwardTo}
                onChange={(e) => setEditForm((p) => (p ? { ...p, forwardTo: e.target.value } : p))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                className={inputClass}
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((p) =>
                    p ? { ...p, category: e.target.value as (typeof CATEGORIES)[number] } : p
                  )
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
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, enabled: e.target.checked } : p))}
                />
                Enabled for outbound send
              </label>
              {isMaster ? (
                <>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.authAllowed}
                      onChange={(e) => setEditForm((p) => (p ? { ...p, authAllowed: e.target.checked } : p))}
                    />
                    <Shield size={14} aria-hidden="true" />
                    Mission Control login
                  </label>
                  <select
                    className={inputClass + " max-w-[10rem]"}
                    value={editForm.authRole}
                    disabled={!editForm.authAllowed}
                    onChange={(e) =>
                      setEditForm((p) =>
                        p ? { ...p, authRole: e.target.value as (typeof AUTH_ROLES)[number] } : p
                      )
                    }
                  >
                    {AUTH_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
          </form>
        ) : null}
      </Modal>

      {message ? (
        <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} onDismiss={() => setMessage(null)} />
      ) : null}
    </div>
  );
}
