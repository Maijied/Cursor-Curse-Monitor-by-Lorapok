import { envWithCursorCloudflareSecrets } from "./cred-vault-sync.mjs";
import {
  pickDeployAuth,
  probeDeployToken,
  resolveMailCredentials,
  tryWranglerOAuthToken,
  wranglerDeployEnv,
} from "./mail-credentials.mjs";

const DEFAULT_ACCOUNT_ID = "f049faaf2f67549f5c58837479596a4a";

function withAccountId(env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    return { ...env, CLOUDFLARE_ACCOUNT_ID: DEFAULT_ACCOUNT_ID };
  }
  return env;
}

/**
 * Cred vault first. Prefer Global API Key over stale bearer tokens.
 * Wrangler OAuth is deploy-only last resort (never copied to email token).
 */
export function resolveLocalMailEnv(baseEnv = process.env, adminDir) {
  const env = withAccountId(envWithCursorCloudflareSecrets(baseEnv));
  const { accountId, deployToken, globalApiKey, globalApiEmail } = resolveMailCredentials(env);

  if (globalApiKey && globalApiEmail) {
    return wranglerDeployEnv(accountId, { type: "global", apiKey: globalApiKey, email: globalApiEmail }, env);
  }

  if (deployToken?.trim()) {
    return env;
  }

  if (adminDir) {
    const oauth = tryWranglerOAuthToken(adminDir);
    if (oauth) {
      console.log("Using wrangler OAuth for deploy only (no cred vault deploy token).");
      return wranglerDeployEnv(accountId, { type: "bearer", token: oauth }, env);
    }
  }

  return env;
}

/** Vault probe → wranglerDeployEnv; OAuth only when vault deploy probe fails. */
export async function resolveLocalMailEnvAsync(baseEnv = process.env, adminDir) {
  const env = withAccountId(envWithCursorCloudflareSecrets(baseEnv));
  const accountId = env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;

  const { auth, probe } = await pickDeployAuth(env);
  if (probe.ok && auth) {
    return wranglerDeployEnv(accountId, auth, env);
  }

  const oauth = adminDir ? tryWranglerOAuthToken(adminDir) : null;
  if (oauth) {
    const oauthProbe = await probeDeployToken(oauth, accountId);
    if (oauthProbe.ok) {
      console.log("Vault deploy credentials failed probe; using wrangler OAuth (deploy only).");
      return wranglerDeployEnv(accountId, { type: "bearer", token: oauth }, env);
    }
  }

  console.warn(
    `No valid deploy credential in cred vault (HTTP ${probe.status ?? "n/a"}). ` +
      "Run: node website/admin/scripts/verify-mail-cred-vault.mjs"
  );
  return env;
}
