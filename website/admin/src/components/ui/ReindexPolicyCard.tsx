import { useCallback, useEffect, useState } from "react";
import { Database, Save } from "lucide-react";
import Card from "./Card";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Badge from "./Badge";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { auth } from "../../lib/firebase";
import { useIntervalRefresh } from "../../hooks/useIntervalRefresh";
import {
  fetchCursorIndexPolicyConfigApi,
  putCursorIndexPolicyConfigApi,
  type CursorIndexPolicyConfig,
} from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

/**
 * Configure unified cursor index policy pushed to the IDE extension via GET /api/site-config.
 */
export default function ReindexPolicyCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<CursorIndexPolicyConfig | null>(null);
  const [form, setForm] = useState({
    indexEnabled: true,
    indexWritePolicy: "live" as "live" | "quit-first",
    cipExportEnabled: true,
    cipImportEnabled: true,
    transcriptLookbackDays: 0,
    maxReindexRecords: 5000,
    maxExportRecords: 5000,
    maxImportRecords: 5000,
    cipRequireSanitization: true,
    cipDedupeAcrossUsers: false,
    cipAllowCrossUserLocalImport: false,
  });

  const load = useCallback(() => {
    fetchCursorIndexPolicyConfigApi()
      .then((data) => {
        setConfig(data.config);
        setForm({
          indexEnabled: data.config.indexEnabled,
          indexWritePolicy: data.config.indexWritePolicy,
          cipExportEnabled: data.config.cipExportEnabled,
          cipImportEnabled: data.config.cipImportEnabled,
          transcriptLookbackDays: data.config.transcriptLookbackDays,
          maxReindexRecords: data.config.maxReindexRecords,
          maxExportRecords: data.config.maxExportRecords,
          maxImportRecords: data.config.maxImportRecords,
          cipRequireSanitization: data.config.cipRequireSanitization,
          cipDedupeAcrossUsers: data.config.cipDedupeAcrossUsers,
          cipAllowCrossUserLocalImport: data.config.cipAllowCrossUserLocalImport,
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
      const result = await putCursorIndexPolicyConfigApi(form);
      setConfig(result.config);
      setMessage({ type: "success", text: "Cursor index policy saved." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const lookbackSummary =
    form.transcriptLookbackDays <= 0
      ? "All transcripts"
      : form.transcriptLookbackDays === 1
        ? "Last 1 day"
        : `Last ${form.transcriptLookbackDays} days`;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Database size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Cursor index
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Controls reindex, export, and import for the IDE extension on macOS, Windows, and Linux.
            Extensions poll <code className="font-[family-name:var(--font-mono)]">GET /api/site-config</code>.
          </p>
        </div>
        {config && (
          <Badge variant={config.indexEnabled ? "synced" : "warn"}>
            {config.indexEnabled
              ? config.indexWritePolicy === "live"
                ? "Live index"
                : "Quit-first"
              : "Disabled"}
          </Badge>
        )}
      </div>

      {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

      {loading ? (
        <div className="flex items-center gap-3 py-6 justify-center text-sm text-[var(--color-muted)]">
          <LorapokLarvaeLoader size="sm" ariaLabel="Loading cursor index settings" className="!flex-row !gap-3" />
          <span>Loading cursor index policy…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.indexEnabled}
              onChange={(e) => setForm((prev) => ({ ...prev, indexEnabled: e.target.checked }))}
              disabled={!isMaster}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">Allow conversation indexing</span>
              <span className="text-[var(--color-muted)]">
                When off, the extension hides reindex/export/import actions and blocks the commands.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="index-write-policy" className="block text-sm font-medium mb-2">
              Write policy
            </label>
            <select
              id="index-write-policy"
              value={form.indexWritePolicy}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  indexWritePolicy: e.target.value === "quit-first" ? "quit-first" : "live",
                }))
              }
              disabled={!isMaster || !form.indexEnabled}
              className={inputClass}
            >
              <option value="live">Live — write while editor is open (backup first)</option>
              <option value="quit-first">Quit-first — require fully quit editor before writing</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="transcript-lookback-days" className="block text-sm font-medium mb-2">
                Transcript lookback (days)
              </label>
              <input
                id="transcript-lookback-days"
                type="number"
                min={0}
                max={3650}
                value={form.transcriptLookbackDays}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    transcriptLookbackDays: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                disabled={!isMaster || !form.indexEnabled}
                className={inputClass}
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">{lookbackSummary}. Use 0 for all time.</p>
            </div>
            <div>
              <label htmlFor="max-reindex-records" className="block text-sm font-medium mb-2">
                Max records per reindex
              </label>
              <input
                id="max-reindex-records"
                type="number"
                min={0}
                max={100000}
                value={form.maxReindexRecords}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    maxReindexRecords: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                disabled={!isMaster || !form.indexEnabled}
                className={inputClass}
              />
              <FieldHelp label="Reindex cap" className="mt-2">
                Limits how many chat records the IDE extension indexes per run. 0 means unlimited (higher disk and API load).
              </FieldHelp>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.cipExportEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, cipExportEnabled: e.target.checked }))}
                disabled={!isMaster || !form.indexEnabled}
                className="mt-1"
              />
              <span>
                <span className="font-medium block">Allow export packages</span>
                <span className="text-[var(--color-muted)]">Writes sanitized .cip.json files locally.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.cipImportEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, cipImportEnabled: e.target.checked }))}
                disabled={!isMaster || !form.indexEnabled}
                className="mt-1"
              />
              <span>
                <span className="font-medium block">Allow import packages</span>
                <span className="text-[var(--color-muted)]">Merges into active account search + sidebar DBs.</span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="max-export-records" className="block text-sm font-medium mb-2">
                Max records per export
              </label>
              <input
                id="max-export-records"
                type="number"
                min={0}
                max={100000}
                value={form.maxExportRecords}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    maxExportRecords: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                disabled={!isMaster || !form.indexEnabled || !form.cipExportEnabled}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="max-import-records" className="block text-sm font-medium mb-2">
                Max records per import
              </label>
              <input
                id="max-import-records"
                type="number"
                min={0}
                max={100000}
                value={form.maxImportRecords}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    maxImportRecords: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                disabled={!isMaster || !form.indexEnabled || !form.cipImportEnabled}
                className={inputClass}
              />
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.cipRequireSanitization}
              onChange={(e) => setForm((prev) => ({ ...prev, cipRequireSanitization: e.target.checked }))}
              disabled={!isMaster || !form.indexEnabled}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">Require secret sanitization on export</span>
              <span className="text-[var(--color-muted)]">Redacts detected secrets before writing packages.</span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.cipDedupeAcrossUsers}
                onChange={(e) => setForm((prev) => ({ ...prev, cipDedupeAcrossUsers: e.target.checked }))}
                disabled={!isMaster || !form.indexEnabled || !form.cipImportEnabled}
                className="mt-1"
              />
              <span>
                <span className="font-medium block">Dedupe imports across owners</span>
                <span className="text-[var(--color-muted)]">
                  Skip records whose content hash already exists from any prior import.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.cipAllowCrossUserLocalImport}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cipAllowCrossUserLocalImport: e.target.checked }))
                }
                disabled={!isMaster || !form.indexEnabled || !form.cipImportEnabled}
                className="mt-1"
              />
              <span>
                <span className="font-medium block">Allow cross-account package import</span>
                <span className="text-[var(--color-muted)]">
                  Permits importing .cip.json files exported from another Cursor account on this machine.
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
              {saving ? "Saving…" : "Save settings"}
            </button>
            {!isMaster && <p className="text-xs text-[var(--color-warn)]">Master admin only.</p>}
          </div>
        </form>
      )}
    </Card>
  );
}
