import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import FieldHelp from "./FieldHelp";
import { fetchCloudflareConfigApi, type CloudflareIntegrationConfig } from "../../lib/api";

export default function CredVaultConfigCard() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<CloudflareIntegrationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCloudflareConfigApi()
      .then((data) => setConfig(data.config))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <KeyRound size={18} className="text-[var(--color-accent)]" aria-hidden="true" />
            Credential vault (CI)
          </h3>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Local gpg vault is the source of truth. GitHub Actions decrypts it with the pin secret — never commit plaintext
            keys to the repo.
          </p>
        </div>
        {config && (
          <Badge variant={config.credVaultCiConfigured ? "synced" : "warn"}>
            {config.credVaultCiConfigured ? "CI decrypt ready" : "CI blob missing"}
          </Badge>
        )}
      </div>

      {loading ? (
        <LorapokLarvaeLoader label="Loading cred vault status…" />
      ) : error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            {[
              ["CRED_STORE_GPG_BASE64", config?.secretsPresent?.includes("CRED_STORE_GPG_BASE64")],
              ["CRED_VAULT_PASSPHRASE", config?.secretsPresent?.includes("CRED_VAULT_PASSPHRASE")],
              ["CLOUDFLARE_API_KEY (fallback)", config?.globalApiKeyConfigured],
              ["CLOUDFLARE_EMAIL (fallback)", config?.accountEmailConfigured],
            ].map(([label, ok]) => (
              <div
                key={String(label)}
                className="flex justify-between items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
              >
                <dt className="text-[var(--color-muted)]">{label}</dt>
                <dd>
                  <Badge variant={ok ? "synced" : "warn"}>{ok ? "Set" : "Missing"}</Badge>
                </dd>
              </div>
            ))}
          </dl>

          <FieldHelp label="Maintain vault locally">
            <ol className="list-decimal list-inside space-y-1 mt-2 text-xs text-[var(--color-muted)]">
              <li>Edit secrets: <code>cred set cursor …</code> or <code>cred set cloudfare …</code></li>
              <li>Verify: <code>node website/admin/scripts/verify-cloudflare-cred-vault.mjs</code></li>
              <li>Upload CI blob: <code>node website/admin/scripts/sync-cred-vault-github.mjs</code></li>
              <li>Propagate deploy keys: <code>node website/admin/scripts/sync-cloudflare-cred-vault.mjs</code></li>
            </ol>
          </FieldHelp>

          <FieldHelp label="CI deploy">
            Admin deploy job runs <code>load-cred-vault-env-ci.mjs</code> before Cloudflare steps. Settings tabs sync
            individual secrets to GitHub when you rotate from the UI.
          </FieldHelp>
        </div>
      )}
    </Card>
  );
}
