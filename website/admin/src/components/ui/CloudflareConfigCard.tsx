import { useEffect, useState } from "react";
import { Cloud, Save } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import Notification from "./Notification";
import FieldHelp from "./FieldHelp";
import { auth } from "../../lib/firebase";
import { fetchCloudflareConfigApi, putCloudflareConfigApi, type CloudflareIntegrationConfig } from "../../lib/api";
import { isMasterAdmin } from "../../lib/admin-config";

export default function CloudflareConfigCard() {
  const isMaster = isMasterAdmin(auth.currentUser?.email);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<CloudflareIntegrationConfig | null>(null);
  const [accountId, setAccountId] = useState("");
  const [pagesProjectName, setPagesProjectName] = useState("");
  const [adminPublicUrl, setAdminPublicUrl] = useState("");
  const [siteDataUrl, setSiteDataUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [globalApiKey, setGlobalApiKey] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [emailApiToken, setEmailApiToken] = useState("");
  const [cronSecret, setCronSecret] = useState("");

  useEffect(() => {
    fetchCloudflareConfigApi()
      .then((data) => {
        setConfig(data.config);
        setAccountId(data.config.accountId ?? "");
        setPagesProjectName(data.config.pagesProjectName ?? "");
        setAdminPublicUrl(data.config.adminPublicUrl ?? "");
        setSiteDataUrl(data.config.siteDataUrl ?? "");
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
      const payload: Record<string, string> = {
        accountId: accountId.trim(),
        pagesProjectName: pagesProjectName.trim(),
        adminPublicUrl: adminPublicUrl.trim(),
        siteDataUrl: siteDataUrl.trim(),
      };
      if (apiToken.trim()) payload.apiToken = apiToken.trim();
      if (globalApiKey.trim()) payload.globalApiKey = globalApiKey.trim();
      if (accountEmail.trim()) payload.accountEmail = accountEmail.trim();
      if (emailApiToken.trim()) payload.emailApiToken = emailApiToken.trim();
      if (cronSecret.trim()) payload.cronSecret = cronSecret.trim();

      const result = await putCloudflareConfigApi(payload);
      setConfig(result.config);
      setApiToken("");
      setGlobalApiKey("");
      setAccountEmail("");
      setEmailApiToken("");
      setCronSecret("");
      const syncNote = result.githubSyncWarning
        ? ` ${result.githubSyncWarning}`
        : result.githubSecretsSyncedAt
          ? " GitHub secrets updated."
          : "";
      setMessage({ type: result.githubSyncWarning ? "error" : "success", text: `Cloudflare settings saved.${syncNote}` });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  };

  const transportOk =
    config &&
    (config.apiTokenConfigured ||
      (config.globalApiKeyConfigured && config.accountEmailConfigured) ||
      config.emailApiTokenConfigured ||
      config.cronSecretConfigured);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Cloud size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Cloudflare
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Pages project, public URLs, and deploy credentials. Non-empty secret fields sync to GitHub{" "}
            <code className="text-xs">admin-production</code> on save. CI can also decrypt the local cred vault when{" "}
            <code className="text-xs">CRED_STORE_GPG_BASE64</code> +{" "}
            <code className="text-xs">CRED_VAULT_PASSPHRASE</code> are present.
          </p>
        </div>
        {config && (
          <div className="flex flex-wrap gap-2">
            <Badge variant={transportOk ? "synced" : "warn"}>{transportOk ? "Deploy auth" : "Check secrets"}</Badge>
            {config.credVaultCiConfigured ? (
              <Badge variant="synced">Cred vault CI</Badge>
            ) : (
              <Badge variant="warn">Cred vault CI</Badge>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading Cloudflare settings…" />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="cf-account-id">
              Account ID
              {config?.accountIdPreview ? (
                <span className="text-[var(--color-muted)] font-normal ml-2">({config.accountIdPreview})</span>
              ) : null}
            </label>
            <input
              id="cf-account-id"
              className={inputClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={!isMaster}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="cf-pages-project">
              Pages project
            </label>
            <input
              id="cf-pages-project"
              className={inputClass}
              value={pagesProjectName}
              onChange={(e) => setPagesProjectName(e.target.value)}
              disabled={!isMaster}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="cf-admin-url">
              Admin public URL
            </label>
            <input
              id="cf-admin-url"
              className={inputClass}
              value={adminPublicUrl}
              onChange={(e) => setAdminPublicUrl(e.target.value)}
              disabled={!isMaster}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="cf-site-data-url">
              Site data URL
            </label>
            <input
              id="cf-site-data-url"
              className={inputClass}
              value={siteDataUrl}
              onChange={(e) => setSiteDataUrl(e.target.value)}
              disabled={!isMaster}
            />
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] space-y-4">
            <p className="text-sm font-medium">Rotate GitHub environment secrets</p>

            {(
              [
                ["apiToken", "CLOUDFLARE_API_TOKEN (Bearer)", apiToken, setApiToken, config?.apiTokenConfigured],
                [
                  "globalApiKey",
                  "CLOUDFLARE_API_KEY (Global API Key)",
                  globalApiKey,
                  setGlobalApiKey,
                  config?.globalApiKeyConfigured,
                ],
                [
                  "accountEmail",
                  "CLOUDFLARE_EMAIL (Global API Key email)",
                  accountEmail,
                  setAccountEmail,
                  config?.accountEmailConfigured,
                ],
                ["emailApiToken", "CLOUDFLARE_EMAIL_API_TOKEN", emailApiToken, setEmailApiToken, config?.emailApiTokenConfigured],
                ["cronSecret", "CRON_SECRET", cronSecret, setCronSecret, config?.cronSecretConfigured],
              ] as const
            ).map(([id, label, value, setter, configured]) => (
              <div key={id}>
                <label className="block text-sm font-medium mb-1.5" htmlFor={`cf-${id}`}>
                  {label}
                  {configured ? (
                    <Badge variant="synced" className="ml-2 !text-[10px]">
                      on server
                    </Badge>
                  ) : null}
                </label>
                <input
                  id={`cf-${id}`}
                  type="password"
                  autoComplete="off"
                  className={inputClass}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  disabled={!isMaster}
                  placeholder="Leave blank to keep current"
                />
              </div>
            ))}
            <FieldHelp label="GitHub secrets">
              Pages runtime still reads Cloudflare Pages secrets — update those via deploy-infra or wrangler after rotating.
              Prefer Global API Key + email when Bearer tokens expire. After updating the local gpg vault, run{" "}
              <code className="text-xs">node website/admin/scripts/sync-cred-vault-github.mjs</code> so CI decrypts the
              same source of truth.
            </FieldHelp>
          </div>

          {!isMaster && (
            <p className="text-xs text-[var(--color-muted)]">Only the master admin can edit Cloudflare settings.</p>
          )}

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
