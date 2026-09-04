/**
 * Resolve a working Cloudflare deploy token: cred vault → probe → wrangler OAuth.
 */
import { resolveLocalMailEnv } from "./resolve-local-mail-env.mjs";
import { pickDeployAuth, probeDeployToken, tryWranglerOAuthToken, wranglerDeployEnv } from "./mail-credentials.mjs";

/**
 * @param {string} adminDir
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {Promise<{ deployToken: string; accountId: string; via: string; wranglerEnv: NodeJS.ProcessEnv }>}
 */
export async function resolveDeployAuth(adminDir, baseEnv = process.env) {
  const env = resolveLocalMailEnv(baseEnv, adminDir);
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID missing.");
  }

  let { auth, probe } = await pickDeployAuth(env);
  if (probe.ok && auth) {
    const deployToken = auth.type === "bearer" ? auth.token : "";
    return {
      deployToken,
      accountId,
      via: probe.via ?? (auth.type === "global" ? "global-key" : "token"),
      wranglerEnv: wranglerDeployEnv(accountId, auth, env),
    };
  }

  const oauth = tryWranglerOAuthToken(adminDir);
  if (oauth) {
    const oauthProbe = await probeDeployToken(oauth, accountId);
    if (oauthProbe.ok) {
      console.log(
        `Using wrangler OAuth token (stored deploy credential invalid or expired: HTTP ${probe.status}).`
      );
      console.log(
        "  Tip: refresh vault token later with: node website/admin/scripts/sync-mail-cred-vault.mjs"
      );
      const oauthAuth = { type: "bearer", token: oauth };
      return {
        deployToken: oauth,
        accountId,
        via: "wrangler-oauth",
        wranglerEnv: wranglerDeployEnv(accountId, oauthAuth, env),
      };
    }
  }

  throw new Error(
    "No valid Cloudflare deploy credential.\n" +
      `  Vault/env probe failed (HTTP ${probe.status}).\n` +
      "  Fix options:\n" +
      "    • unset CLOUDFLARE_API_TOKEN && cd website/admin && npx wrangler login\n" +
      '    • cred set cursor cloudflare_api_token  (Account → Cloudflare Pages → Edit + Workers Scripts → Edit)\n' +
      "    • cred vault: cloudfare/cloudfare_global_api_key + cursor/cloudflare_account_email\n" +
      "    • node website/admin/scripts/sync-mail-cred-vault.mjs  (after wrangler login)"
  );
}
