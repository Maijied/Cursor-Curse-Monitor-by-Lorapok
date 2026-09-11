import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import Card from "./Card";
import Badge from "./Badge";
import LorapokLarvaeLoader from "./LorapokLarvaeLoader";
import FieldHelp from "./FieldHelp";
import ReadOnlyAclBanner from "./ReadOnlyAclBanner";
import {
  fetchCloudflareConfigApi,
  fetchCredSyncStatusApi,
  type CloudflareIntegrationConfig,
  type CredSyncHealthStatus,
} from "../../lib/api";
import { useAuthSession } from "../../lib/use-auth-session";

export default function CredVaultConfigCard() {
  const { hasPermission } = useAuthSession();
  const canManageSecrets = hasPermission("secrets.manage");
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<CloudflareIntegrationConfig | null>(null);
  const [credSync, setCredSync] = useState<CredSyncHealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCloudflareConfigApi(), fetchCredSyncStatusApi()])
      .then(([cloudflare, sync]) => {
        setConfig(cloudflare.config);
        setCredSync(sync.status);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const syncBadge = credSync?.neverMiss
    ? { variant: "synced" as const, label: "Sync never miss" }
    : credSync?.lastSyncOk
      ? { variant: "synced" as const, label: "Last sync OK" }
      : credSync?.lastError
        ? { variant: "danger" as const, label: "Sync failed" }
        : { variant: "warn" as const, label: "Awaiting sync" };

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
        <div className="flex flex-wrap gap-2">
          {config && (
            <Badge variant={config.credVaultCiConfigured ? "synced" : "warn"}>
              {config.credVaultCiConfigured ? "CI decrypt ready" : "CI blob missing"}
            </Badge>
          )}
          {credSync && <Badge variant={syncBadge.variant}>{syncBadge.label}</Badge>}
        </div>
      </div>

      {!canManageSecrets ? (
        <ReadOnlyAclBanner permission="secrets.manage" feature="Credential vault maintenance" />
      ) : null}

      {loading ? (
        <LorapokLarvaeLoader label="Loading cred vault status…" />
      ) : error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : (
        <div className="space-y-4 text-sm">
          {credSync && !credSync.neverMiss && credSync.driftMissing.length > 0 ? (
            <p className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 px-3 py-2 text-[var(--color-danger)]">
              Missing GitHub secrets: {credSync.driftMissing.join(", ")}
            </p>
          ) : null}
          {credSync?.lastError ? (
            <p className="text-[var(--color-danger)]">Last sync error: {credSync.lastError}</p>
          ) : null}

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

          {credSync?.recentAttempts?.length ? (
            <FieldHelp label="Recent Settings secret syncs">
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">
                {credSync.recentAttempts.map((attempt) => (
                  <li key={attempt.ts}>
                    {attempt.ts.slice(0, 19).replace("T", " ")} — {attempt.integration}{" "}
                    {attempt.ok ? "OK" : "failed"}
                    {attempt.retryCount ? ` (retried ${attempt.retryCount}×)` : ""}
                  </li>
                ))}
              </ul>
            </FieldHelp>
          ) : null}

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
            individual secrets to GitHub with automatic retry and audit logging — failures surface here instead of silently missing.
          </FieldHelp>
        </div>
      )}
    </Card>
  );
}
