/**
 * Resolve a working Cloudflare deploy token: cred vault → probe → wrangler OAuth.
 */
import { resolveLocalMailEnv } from "./resolve-local-mail-env.mjs";
import {
  pickDeployToken,
  probeDeployToken,
  tryWranglerOAuthToken,
} from "./mail-credentials.mjs";

/**
 * @param {string} adminDir
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {Promise<{ deployToken: string; accountId: string; via: string }>}
 */
export async function resolveDeployAuth(adminDir, baseEnv = process.env) {
  const env = resolveLocalMailEnv(baseEnv, adminDir);
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID missing.");
  }

  let { token, probe } = await pickDeployToken(env);
  if (probe.ok) {
    return { deployToken: token, accountId, via: probe.via ?? "token" };
  }

  const oauth = tryWranglerOAuthToken(adminDir);
  if (oauth) {
    const oauthProbe = await probeDeployToken(oauth, accountId);
    if (oauthProbe.ok) {
      console.log(
        `Using wrangler OAuth token (stored deploy token invalid or expired: HTTP ${probe.status}).`
      );
      console.log(
        "  Tip: refresh vault token later with: node website/admin/scripts/sync-mail-cred-vault.mjs"
      );
      return { deployToken: oauth, accountId, via: "wrangler-oauth" };
    }
  }

  throw new Error(
    "No valid Cloudflare deploy token.\n" +
      `  Vault/env token probe failed (HTTP ${probe.status}).\n` +
      "  Fix options:\n" +
      "    • unset CLOUDFLARE_API_TOKEN && cd website/admin && npx wrangler login\n" +
      '    • cred set cursor cloudflare_api_token  (Account → Cloudflare Pages → Edit + Workers Scripts → Edit)\n' +
      "    • node website/admin/scripts/sync-mail-cred-vault.mjs  (after wrangler login)"
  );
}
