import { useEffect, useState } from "react";
import { Eye, Megaphone, Save, Trash2 } from "lucide-react";
import PageHeader from "../layout/PageHeader";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import ShimmerSkeleton from "../ui/ShimmerSkeleton";
import ErrorState from "../ui/ErrorState";
import { fetchNotice, saveNotice, clearNotice } from "../../lib/api";
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
};

export default function Notices() {
  const [form, setForm] = useState<DevNotice>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchNotice()
      .then((data) => {
        if (data.notice) setForm({ ...EMPTY, ...data.notice });
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)]";

  const update = <K extends keyof DevNotice>(key: K, value: DevNotice[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await saveNotice({ ...form, enabled: true, updatedAt: new Date().toISOString() });
      setMessage({ type: "success", text: "Site notice saved and enabled." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const handleDisable = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await clearNotice();
      setForm({ ...form, enabled: false });
      setMessage({ type: "success", text: "Site notice disabled." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Disable failed" });
    }
    setSaving(false);
  };

  if (loading) return <ShimmerSkeleton className="h-64" />;
  if (error) return <ErrorState message={error} />;

  const severityVariant = form.severity === "critical" ? "danger" : form.severity === "warning" ? "warn" : "neutral";

  return (
    <div className="max-w-3xl space-y-8 animate-fade-slide-up">
      <PageHeader
        title="Site Notices"
        description="Manage the public development banner shown on the marketing site via /api/notice."
        action={
          form.enabled ? (
            <Badge variant={severityVariant} pulse>
              <Megaphone size={12} aria-hidden="true" />
              Active
            </Badge>
          ) : (
            <Badge variant="neutral">Disabled</Badge>
          )
        }
      />

      <Card>
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
              {saving ? "Saving…" : "Save & Enable"}
            </button>
            <button
              type="button"
              onClick={handleDisable}
              disabled={saving}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] transition-colors disabled:opacity-50"
            >
              <Trash2 size={18} aria-hidden="true" />
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
          <div
            className={`mt-6 p-4 rounded-xl border ${
              message.type === "success"
                ? "bg-[color-mix(in_srgb,var(--color-ok)_10%,transparent)] border-[color-mix(in_srgb,var(--color-ok)_30%,transparent)] text-[var(--color-ok)]"
                : "bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)]"
            }`}
            role="status"
          >
            {message.text}
          </div>
        )}
      </Card>
    </div>
  );
}
