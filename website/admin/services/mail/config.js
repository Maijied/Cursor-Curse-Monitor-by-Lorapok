/**
 * Mail ops config — redirect target and env merge (vault → MAIL_REDIRECT_TO).
 * Scripts use envWithCursorCloudflareSecrets(); never hardcode vault passphrase.
 */
import { envWithCursorCloudflareSecrets, loadCursorCloudflareSecretsFromVault } from "../../scripts/lib/cred-vault-sync.mjs";

/**
 * @param {Record<string, unknown>} [env]
 * @returns {string} Lowercase redirect address or empty when unset.
 */
export function resolveMailRedirectTo(env = process.env) {
  const direct = String(env.MAIL_REDIRECT_TO ?? "").trim().toLowerCase();
  if (direct.includes("@")) return direct;

  const skipVault = env.CCM_SKIP_CRED_VAULT === "1" || env.CCM_SKIP_CRED_VAULT === "true";
  const merged = skipVault ? env : envWithCursorCloudflareSecrets(env);
  const fromMerged = String(merged.MAIL_REDIRECT_TO ?? "").trim().toLowerCase();
  if (fromMerged.includes("@")) return fromMerged;

  if (skipVault) return "";

  const loaded = loadCursorCloudflareSecretsFromVault();
  const fromVault = String(loaded?.mailRedirectTo ?? "").trim().toLowerCase();
  return fromVault.includes("@") ? fromVault : "";
}

/**
 * Vault + local mail secrets for CLI replay/send scripts.
 * @param {Record<string, unknown>} [baseEnv]
 */
export function resolveMailServiceEnv(baseEnv = process.env) {
  const env = envWithCursorCloudflareSecrets(baseEnv);
  const redirectTo = resolveMailRedirectTo(env);
  return redirectTo ? { ...env, MAIL_REDIRECT_TO: redirectTo } : env;
}
