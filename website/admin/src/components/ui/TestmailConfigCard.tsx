import { useAuthSession } from "../../lib/auth-context";
import { useEffect, useState } from "react";
import { Inbox, Save } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { fetchTestmailConfigApi, putTestmailConfigApi, type TestmailIntegrationConfig } from "../../lib/api";

export default function TestmailConfigCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<TestmailIntegrationConfig | null>(null);
  const [namespace, setNamespace] = useState("");
  const [testmailApiKey, setTestmailApiKey] = useState("");
  const [probeEnabled, setProbeEnabled] = useState(false);

  useEffect(() => {
    fetchTestmailConfigApi()
      .then((data) => {
        setConfig(data.config);
        setNamespace(data.config.namespace ?? "");
        setProbeEnabled(data.config.probeEnabled);
      })
      .catch((err: Error) => setMessage({ type: "error", text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all text-[var(--color-text)] font-[family-name:var(--font-mono)] text-sm";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string | boolean> = {
        namespace: namespace.trim(),
        probeEnabled,
      };
      if (testmailApiKey.trim()) payload.testmailApiKey = testmailApiKey.trim();

      const result = await putTestmailConfigApi(payload);
      setConfig(result.config);
      setTestmailApiKey("");
      const syncNote = result.githubSyncWarning
        ? ` ${result.githubSyncWarning}`
        : result.githubSecretsSyncedAt
          ? " GitHub secrets updated."
          : "";
      setMessage({
        type: result.githubSyncWarning ? "error" : "success",
        text: `Testmail settings saved.${syncNote}`,
      });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const ok = config?.testmailApiKeyConfigured && config?.testmailNamespaceConfigured;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Inbox size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            testmail.app
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Optional E2E subscribe probes for Mailbox and local scripts. Disabled by default — production mail uses Resend.
            Sync API key + namespace only if you re-enable probes.
          </p>
        </div>
        {config && <Badge variant={ok ? "synced" : "warn"}>{ok ? "Configured" : "Incomplete"}</Badge>}
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading testmail settings…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="testmail-namespace" className="block text-sm font-medium mb-1.5">
              TESTMAIL_NAMESPACE
              {config?.namespacePreview ? (
                <span className="text-[var(--color-muted)] font-normal ml-2">({config.namespacePreview})</span>
              ) : null}
            </label>
            <input
              id="testmail-namespace"
              className={inputClass}
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              disabled={!canWrite}
              placeholder="your-namespace"
            />
          </div>
          <div>
            <label htmlFor="testmail-api-key" className="block text-sm font-medium mb-1.5">
              TESTMAIL_API_KEY
              {config?.testmailApiKeyConfigured ? (
                <Badge variant="synced" className="ml-2 !text-[10px]">on server</Badge>
              ) : null}
            </label>
            <input
              id="testmail-api-key"
              type="password"
              autoComplete="off"
              className={inputClass}
              value={testmailApiKey}
              onChange={(e) => setTestmailApiKey(e.target.value)}
              disabled={!canWrite}
              placeholder="Leave blank to keep current"
            />
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={probeEnabled}
              onChange={(e) => setProbeEnabled(e.target.checked)}
              disabled={!canWrite}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">Enable subscribe E2E probes</span>
              <span className="text-[var(--color-muted)]">Mailbox and CI can run testmail delivery checks when creds exist.</span>
            </span>
          </label>

          <FieldHelp label="Cred vault">
            <code className="text-xs">cred set cursor testmail_api_key</code> and{" "}
            <code className="text-xs">cred set cursor testmail_namespace</code>
          </FieldHelp>

          {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

          {canWrite && (
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
