import { useEffect, useState } from "react";
import { Database, Save } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import { auth } from "../../lib/firebase";
import {
  fetchReindexPolicyConfigApi,
  putReindexPolicyConfigApi,
  type ReindexPolicyConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Configure conversation reindex policy pushed to the IDE extension via GET /api/site-config.
 */
export default function ReindexPolicyCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<ReindexPolicyConfig | null>(null);
  const [form, setForm] = useState({
    reindexEnabled: true,
    reindexWritePolicy: "live" as "live" | "quit-first",
  });

  useEffect(() => {
    fetchReindexPolicyConfigApi()
      .then((data) => {
        setConfig(data.config);
        setForm({
          reindexEnabled: data.config.reindexEnabled,
          reindexWritePolicy: data.config.reindexWritePolicy,
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
      const result = await putReindexPolicyConfigApi(form);
      setConfig(result.config);
      setMessage({ type: "success", text: "Reindex policy saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Database size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Conversation reindex
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Controls the dashboard “Reindex missing conversations” recovery tool in the IDE extension.
            Extensions poll <code className="font-[family-name:var(--font-mono)]">GET /api/site-config</code> for
            this policy.
          </p>
        </div>
        {config && (
          <Badge variant={config.reindexEnabled ? "synced" : "warn"}>
            {config.reindexEnabled
              ? config.reindexWritePolicy === "live"
                ? "Live reindex"
                : "Quit-first"
              : "Disabled"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading reindex settings" className="!flex-row !gap-3" />
          <span>Loading reindex policy…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.reindexEnabled}
              onChange={(e) => setForm((prev) => ({ ...prev, reindexEnabled: e.target.checked }))}
              disabled={!isMaster}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">Allow conversation reindex</span>
              <span className="text-[var(--color-muted)]">
                When off, the extension hides the reindex action and blocks the command.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="reindex-write-policy" className="block text-sm font-medium mb-2">
              Write policy
            </label>
            <select
              id="reindex-write-policy"
              value={form.reindexWritePolicy}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  reindexWritePolicy: e.target.value === "quit-first" ? "quit-first" : "live",
                }))
              }
              disabled={!isMaster || !form.reindexEnabled}
              className={inputClass}
            >
              <option value="live">Live — reindex from dashboard while editor is open (backup first)</option>
              <option value="quit-first">Quit-first — require fully quit editor before writing (safest)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!isMaster || saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white font-medium disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save settings"}
            </button>
            {!isMaster && <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>}
          </div>
        </form>
      )}
    </Card>
  );
}
