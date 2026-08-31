import { envWithCursorCloudflareSecrets } from "./cred-vault-sync.mjs";
import { pickDeployToken, probeDeployToken, tryWranglerOAuthToken } from "./mail-credentials.mjs";

const DEFAULT_ACCOUNT_ID = "f049faaf2f67549f5c58837479596a4a";

function withAccountId(env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    return { ...env, CLOUDFLARE_ACCOUNT_ID: DEFAULT_ACCOUNT_ID };
  }
  return env;
}

/** Vault → wrangler OAuth → existing env (local repair / mail scripts). */
export function resolveLocalMailEnv(baseEnv = process.env, adminDir) {
  let env = withAccountId(envWithCursorCloudflareSecrets(baseEnv));

  if (!env.CLOUDFLARE_API_TOKEN?.trim() && adminDir) {
    const token = tryWranglerOAuthToken(adminDir);
    if (token) {
      console.log("Using wrangler OAuth token for CLOUDFLARE_API_TOKEN.");
      env = { ...env, CLOUDFLARE_API_TOKEN: token };
    }
  }

  return env;
}

/**
 * Like {@link resolveLocalMailEnv} but probes deploy tokens and prefers wrangler OAuth
 * when gpg vault tokens are stale (HTTP 401).
 */
export async function resolveLocalMailEnvAsync(baseEnv = process.env, adminDir) {
  let env = withAccountId(envWithCursorCloudflareSecrets(baseEnv));
  const oauth = adminDir ? tryWranglerOAuthToken(adminDir) : null;

  const { token, probe } = await pickDeployToken(env);
  if (probe.ok) {
    env = { ...env, CLOUDFLARE_API_TOKEN: token };
  } else if (oauth) {
    const oauthProbe = await probeDeployToken(oauth, env.CLOUDFLARE_ACCOUNT_ID);
    if (oauthProbe.ok) {
      console.log("Vault/env deploy token invalid; using wrangler OAuth for CLOUDFLARE_API_TOKEN.");
      env = { ...env, CLOUDFLARE_API_TOKEN: oauth };
      if (!env.CLOUDFLARE_EMAIL_API_TOKEN?.trim()) {
        env = { ...env, CLOUDFLARE_EMAIL_API_TOKEN: oauth };
      }
    }
  } else if (!env.CLOUDFLARE_API_TOKEN?.trim()) {
    console.warn("No valid deploy token and wrangler OAuth unavailable (run: npx wrangler login).");
  }

  return env;
}
