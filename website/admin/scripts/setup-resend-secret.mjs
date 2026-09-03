#!/usr/bin/env node
/**
 * Sync RESEND_API_KEY (and optional RESEND_FROM) to Cloudflare Pages secrets.
 * Use this instead of Workers Paid when Cloudflare Email Sending is sandbox-limited.
 *
 *   export RESEND_API_KEY=re_...
 *   export RESEND_FROM="Cursor Curse Monitor <onboarding@resend.dev>"  # or verified domain
 *   cd website/admin && node scripts/setup-resend-secret.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";
import { pickDeployToken } from "./lib/mail-credentials.mjs";
import { envWithCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const project = "cursor-monitor-admin";

const mailEnv = envWithCursorCloudflareSecrets(process.env);
const resendKey = String(mailEnv.RESEND_API_KEY ?? "").trim();
if (!resendKey) {
  console.error("RESEND_API_KEY missing. Add cursor/resend_api_key to cred vault, then re-run.");
  process.exit(1);
}

const resolvedMailEnv = await resolveLocalMailEnvAsync(mailEnv, adminDir);
const { token, probe } = await pickDeployToken(resolvedMailEnv);
if (!token || !probe?.ok) {
  console.error("No valid Cloudflare deploy token. Run: cd website/admin && npx wrangler login");
  process.exit(1);
}

function putSecret(name, value) {
  const result = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", name, "--project-name", project],
    {
      cwd: adminDir,
      input: value,
      encoding: "utf8",
      env: { ...resolvedMailEnv, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token },
    }
  );
  if (result.status !== 0) {
    console.error(`Failed to set Pages secret ${name}`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ Pages secret ${name} updated`);
}

putSecret("RESEND_API_KEY", resendKey);

const resendFrom = String(mailEnv.RESEND_FROM ?? "").trim();
if (resendFrom) {
  putSecret("RESEND_FROM", resendFrom);
} else {
  console.log("Tip: set RESEND_FROM when your Resend domain is verified (default uses product From in mail.js).");
}

console.log("\nResend is configured. External welcome emails use Resend first when resendFirstExternal is enabled (default).");
