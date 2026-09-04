import { useAuthSession } from "../../lib/auth-context";
import { useEffect, useState } from "react";
import { Flame, Save } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { fetchFirebaseConfigApi, putFirebaseConfigApi, type FirebaseIntegrationConfig } from "../../lib/api";

const FIELDS = [
  { key: "apiKey", label: "API key", secret: true },
  { key: "authDomain", label: "Auth domain" },
  { key: "projectId", label: "Project ID" },
  { key: "storageBucket", label: "Storage bucket" },
  { key: "messagingSenderId", label: "Messaging sender ID" },
  { key: "appId", label: "App ID" },
  { key: "measurementId", label: "Measurement ID (optional)" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export default function FirebaseConfigCard() {
  const { hasPermission } = useAuthSession();
  const canWrite = hasPermission("integrations.write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<FirebaseIntegrationConfig | null>(null);
  const [form, setForm] = useState<Record<FieldKey, string>>({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: "",
  });

  useEffect(() => {
    fetchFirebaseConfigApi()
      .then((data) => {
        setConfig(data.config);
        setForm({
          apiKey: "",
          authDomain: data.config.authDomain ?? "",
          projectId: data.config.projectId ?? "",
          storageBucket: data.config.storageBucket ?? "",
          messagingSenderId: data.config.messagingSenderId ?? "",
          appId: data.config.appId ?? "",
          measurementId: data.config.measurementId ?? "",
        });
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
      const payload: Record<string, string> = {
        authDomain: form.authDomain.trim(),
        projectId: form.projectId.trim(),
        storageBucket: form.storageBucket.trim(),
        messagingSenderId: form.messagingSenderId.trim(),
        appId: form.appId.trim(),
        measurementId: form.measurementId.trim(),
      };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();

      const result = await putFirebaseConfigApi(payload);
      setConfig(result.config);
      setForm((prev) => ({ ...prev, apiKey: "" }));
      const syncNote = result.githubSyncWarning
        ? ` ${result.githubSyncWarning}`
        : result.githubSecretsSyncedAt
          ? " GitHub admin-production secrets updated."
          : "";
      setMessage({ type: result.githubSyncWarning ? "error" : "success", text: `Firebase settings saved.${syncNote}` });
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
            <Flame size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Firebase (Google)
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Web client config for admin sign-in. Values sync to GitHub <code className="text-xs">admin-production</code>{" "}
            secrets on save — not stored in source code.
          </p>
        </div>
        {config && (
          <Badge variant={config.configured ? "synced" : "warn"}>
            {config.configured ? "Configured" : "Not configured"}
          </Badge>
        )}
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading Firebase settings…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1.5" htmlFor={`firebase-${field.key}`}>
                {field.label}
                {field.key === "apiKey" && config?.apiKeyPreview ? (
                  <span className="text-[var(--color-muted)] font-normal ml-2">({config.apiKeyPreview})</span>
                ) : null}
              </label>
              <input
                id={`firebase-${field.key}`}
                type={"secret" in field && field.secret ? "password" : "text"}
                autoComplete="off"
                className={inputClass}
                value={form[field.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={"secret" in field && field.secret && config?.configured ? "Leave blank to keep current" : ""}
                disabled={!canWrite}
              />
              {field.key === "projectId" ? (
                <FieldHelp label="Project ID" className="mt-1">
                  Must match Firestore rules and Firebase console project. Also written as FIREBASE_PROJECT_ID secret.
                </FieldHelp>
              ) : null}
            </div>
          ))}

          {config?.githubSecretsSyncedAt && (
            <p className="text-xs text-[var(--color-muted)]">
              Last GitHub secret sync: {new Date(config.githubSecretsSyncedAt).toLocaleString()}
            </p>
          )}

          {!canWrite && (
            <p className="text-xs text-[var(--color-muted)]">Only the master admin can edit Firebase settings.</p>
          )}

          {message && <Notification tone={message.type === "success" ? "success" : "error"} message={message.text} />}

          {canWrite && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-bg-base)] font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "Saving…" : "Save & sync GitHub secrets"}
            </button>
          )}
        </form>
      )}
    </Card>
  );
}
