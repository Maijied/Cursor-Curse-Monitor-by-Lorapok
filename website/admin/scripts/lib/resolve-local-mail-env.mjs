import { envWithCursorCloudflareSecrets } from "./cred-vault-sync.mjs";
import { tryWranglerOAuthToken } from "./mail-credentials.mjs";

const DEFAULT_ACCOUNT_ID = "f049faaf2f67549f5c58837479596a4a";

/** Vault → wrangler OAuth → existing env (local repair / mail scripts). */
export function resolveLocalMailEnv(baseEnv = process.env, adminDir) {
  let env = envWithCursorCloudflareSecrets(baseEnv);

  if (!env.CLOUDFLARE_API_TOKEN?.trim() && adminDir) {
    const token = tryWranglerOAuthToken(adminDir);
    if (token) {
      console.log("Using wrangler OAuth token for CLOUDFLARE_API_TOKEN.");
      env = {
        ...env,
        CLOUDFLARE_API_TOKEN: token,
        ...(env.CLOUDFLARE_EMAIL_API_TOKEN?.trim() ? {} : { CLOUDFLARE_EMAIL_API_TOKEN: token }),
      };
    }
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    env = { ...env, CLOUDFLARE_ACCOUNT_ID: DEFAULT_ACCOUNT_ID };
  }

  return env;
}
