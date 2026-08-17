import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Megaphone, Plus, Power, Save, Trash2 } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import DataTable, { type DataTableColumn } from "../ui/DataTable";
import Notification from "../ui/Notification";
import { createNotice, deleteNotice, fetchNotices, updateNotice } from "../../lib/api";
import type { DevNotice } from "../../lib/site-data";

const SEVERITIES = ["info", "warning", "critical"] as const;

const EMPTY: DevNotice = {
  enabled: false,
  type: "development",
  severity: "warning",
  title: "",
  message: "",
  shortMessage: "",
  feedbackUrl: "",
  collaborateUrl: "",
  updatedAt: new Date().toISOString(),
  dismissible: true,
  id: undefined,
  source: "admin",
};

function noticeKey(row: DevNotice, index: number) {
  return row.id || `${row.title}-${row.updatedAt}-${index}`;
}

export default function Notices() {
  const [form, setForm] = useState<DevNotice>(EMPTY);
  const [items, setItems] = useState<DevNotice[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const applyCatalog = useCallback((nextItems: DevNotice[], preferredId?: string | null) => {
    setItems(nextItems);
    const preferred = preferredId ? nextItems.find((n) => n.id === preferredId) : undefined;
    const active = nextItems.find((n) => n.enabled);
    const selected = preferred ?? active;
    if (selected) setForm({ ...EMPTY, ...selected });
  }, []);

  useEffect(() => {
    fetchNotices()
      .then((data) => {
        applyCatalog(data.items ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [applyCatalog]);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  const update = <K extends keyof DevNotice>(key: K, value: DevNotice[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY, updatedAt: new Date().toISOString() });
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...form, enabled: true, updatedAt: new Date().toISOString() };
      const result = form.id
        ? await updateNotice({ ...payload, id: form.id })
        : await createNotice(payload);
      applyCatalog(result.items ?? [], result.notice?.id);
      setMessage({ type: "success", text: form.id ? "Notice updated and enabled." : "Notice saved and enabled." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleDisable = async () => {
    if (!form.id) {
      setForm({ ...form, enabled: false });
      setMessage({ type: "success", text: "Draft notice is not live." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateNotice({ id: form.id, enabled: false });
      applyCatalog(result.items ?? [], form.id);
      setMessage({ type: "success", text: "Notice disabled." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Disable failed" });
    }
    setSaving(false);
  };

  const handleToggle = async (row: DevNotice) => {
    if (!row.id) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateNotice({ id: row.id, enabled: !row.enabled });
      applyCatalog(result.items ?? [], form.id);
      setMessage({
        type: "success",
        text: row.enabled ? `"${row.title}" disabled.` : `"${row.title}" enabled on the marketing site.`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Update failed" });
    }
    setSaving(false);
  };

  const handleDelete = async (row: DevNotice) => {
    if (!row.id) return;
    if (!window.confirm(`Delete “${row.title || "this notice"}”? This cannot be undone.`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await deleteNotice(row.id);
      const remaining = result.items ?? [];
      setItems(remaining);
      if (form.id === row.id) {
        const active = remaining.find((n) => n.enabled);
        setForm(active ? { ...EMPTY, ...active } : { ...EMPTY, updatedAt: new Date().toISOString() });
      }
      setMessage({ type: "success", text: `"${row.title}" deleted.` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Delete failed" });
    }
    setSaving(false);
  };

  const filteredItems = useMemo(() => {
    if (statusFilter === "enabled") return items.filter((n) => n.enabled);
    if (statusFilter === "disabled") return items.filter((n) => !n.enabled);
    if (statusFilter === "generated") return items.filter((n) => n.source === "generated");
    return items;
  }, [items, statusFilter]);

  const columns: DataTableColumn<DevNotice>[] = [
    {
      key: "title",
      header: "Notice",
      searchValue: (row) => `${row.title} ${row.shortMessage} ${row.message}`,
      render: (row) => (
        <button
          type="button"
          onClick={() => setForm({ ...EMPTY, ...row })}
          className="text-left font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          {row.title || "Untitled"}
          {row.shortMessage && (
            <span className="block text-xs font-normal text-[var(--color-muted)] mt-1 line-clamp-2">
              {row.shortMessage}
            </span>
          )}
        </button>
      ),
    },
    {
      key: "source",
      header: "Source",
      searchValue: (row) => row.source ?? "admin",
      render: (row) => (
        <Badge variant={row.source === "generated" ? "warn" : "neutral"}>
          {row.source === "generated" ? "Generated" : "Admin"}
        </Badge>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      searchValue: (row) => row.severity,
      render: (row) => {
        const variant = row.severity === "critical" ? "danger" : row.severity === "warning" ? "warn" : "neutral";
        return <Badge variant={variant}>{row.severity}</Badge>;
      },
    },
    {
      key: "status",
      header: "Status",
      searchValue: (row) => (row.enabled ? "enabled live" : "disabled"),
      render: (row) =>
        row.enabled ? (
          <Badge variant="synced" pulse>
            Live
          </Badge>
        ) : (
          <Badge variant="neutral">Disabled</Badge>
        ),
    },
    {
      key: "updated",
      header: "Updated",
      searchValue: (row) => row.updatedAt ?? "",
      render: (row) => (
        <span className="text-[var(--color-muted)] font-[family-name:var(--font-mono)] text-xs">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={saving || !row.id}
            onClick={() => handleToggle(row)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs hover:bg-white/5 disabled:opacity-50"
          >
            <Power size={14} aria-hidden="true" />
            {row.enabled ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            disabled={saving || !row.id}
            onClick={() => handleDelete(row)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] text-[var(--color-danger)] text-xs hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  const severityVariant = form.severity === "critical" ? "danger" : form.severity === "warning" ? "warn" : "neutral";
  const liveCount = items.filter((n) => n.enabled).length;
  const editing = Boolean(form.id);

  return (
    <div className="space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Site Notices"
        description="Catalog of generated and admin notices. Only one can be live on the marketing banner at a time. Disable or delete here to hide it from the website."
        action={
          liveCount > 0 ? (
            <Badge variant={severityVariant} pulse>
              <Megaphone size={12} aria-hidden="true" />
              {liveCount} live
            </Badge>
          ) : (
            <Badge variant="neutral">None live</Badge>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            {editing ? "Edit notice" : "New notice"}
          </h3>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              <Plus size={16} aria-hidden="true" />
              New notice
            </button>
          )}
        </div>
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label htmlFor="notice-title" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Title</label>
            <input
              id="notice-title"
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
              className={inputClass}
              placeholder="Active Development Notice"
            />
          </div>

          <div>
            <label htmlFor="notice-short" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Short message (banner)</label>
            <input
              id="notice-short"
              type="text"
              value={form.shortMessage}
              onChange={(e) => update("shortMessage", e.target.value)}
              className={inputClass}
              placeholder="Brief one-line summary for the banner"
            />
          </div>

          <div>
            <label htmlFor="notice-message" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Full message</label>
            <textarea
              id="notice-message"
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Detailed notice text for reports and expanded views"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="notice-severity" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Severity</label>
              <select
                id="notice-severity"
                value={form.severity}
                onChange={(e) => update("severity", e.target.value)}
                className={inputClass}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-[var(--color-border)] w-full">
                <input
                  type="checkbox"
                  checked={form.dismissible}
                  onChange={(e) => update("dismissible", e.target.checked)}
                  className="rounded border-[var(--color-border)]"
                />
                <span className="text-sm text-[var(--color-text)]">Dismissible by visitors</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="notice-feedback" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Feedback URL</label>
            <input
              id="notice-feedback"
              type="url"
              value={form.feedbackUrl}
              onChange={(e) => update("feedbackUrl", e.target.value)}
              className={inputClass}
              placeholder="https://github.com/.../issues"
            />
          </div>

          <div>
            <label htmlFor="notice-collab" className="block text-sm font-medium mb-2 text-[var(--color-muted)]">Collaborate URL</label>
            <input
              id="notice-collab"
              type="url"
              value={form.collaborateUrl}
              onChange={(e) => update("collaborateUrl", e.target.value)}
              className={inputClass}
              placeholder="https://github.com/.../discussions"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-white/5 transition-colors"
            >
              <Eye size={18} aria-hidden="true" />
              {showPreview ? "Hide preview" : "Preview"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
            >
              <Save size={18} aria-hidden="true" />
              {saving ? "Saving…" : editing ? "Update & Enable" : "Save & Enable"}
            </button>
            <button
              type="button"
              onClick={handleDisable}
              disabled={saving || !form.id || !form.enabled}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] transition-colors disabled:opacity-50"
            >
              <Power size={18} aria-hidden="true" />
              Disable
            </button>
          </div>
        </form>

        {showPreview && (
          <div
            className={`mt-6 p-4 rounded-xl border ${
              form.severity === "critical"
                ? "border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)]"
                : form.severity === "warning"
                  ? "border-[color-mix(in_srgb,var(--color-warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-warn)_8%,transparent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-base)]"
            }`}
          >
            <p className="font-semibold text-[var(--color-text)] mb-1">{form.title || "Notice title"}</p>
            <p className="text-sm text-[var(--color-muted)]">{form.shortMessage || form.message || "Notice message"}</p>
            {(form.feedbackUrl || form.collaborateUrl) && (
              <div className="flex gap-4 mt-3 text-sm">
                {form.feedbackUrl && <span className="text-[var(--color-accent-2)]">Share feedback →</span>}
                {form.collaborateUrl && <span className="text-[var(--color-accent-2)]">Collaborate →</span>}
              </div>
            )}
          </div>
        )}

        {message && (
          <Notification
            tone={message.type === "success" ? "success" : "error"}
            title={message.type === "success" ? "Notice saved" : "Action failed"}
            message={message.text}
            onDismiss={() => setMessage(null)}
            className="mt-6"
          />
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2 flex items-center gap-2">
          <Megaphone size={20} className="text-[var(--color-accent)]" aria-hidden="true" />
          All notices
        </h3>
        <p className="text-sm text-[var(--color-muted)] mb-5">
          Generated marketing news is imported here once. Enable one row to show it on the website, or disable/delete to hide it.
        </p>
        <DataTable
          columns={columns}
          rows={filteredItems}
          getRowKey={noticeKey}
          emptyMessage="No notices in the catalog yet."
          filterOptions={[
            { value: "", label: "All notices" },
            { value: "enabled", label: "Live" },
            { value: "disabled", label: "Disabled" },
            { value: "generated", label: "Generated" },
          ]}
          filterValue={statusFilter}
          onFilterChange={setStatusFilter}
          filterLabel="Status"
        />
      </Card>
    </div>
  );
}
