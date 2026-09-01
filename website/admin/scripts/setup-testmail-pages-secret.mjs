#!/usr/bin/env node
/**
 * Sync testmail.app credentials to Cloudflare Pages secrets for Mailbox E2E probes.
 *
 *   export TESTMAIL_API_KEY=...
 *   export TESTMAIL_NAMESPACE=61z27
 *   cd website/admin && node scripts/setup-testmail-pages-secret.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";
import { pickDeployToken } from "./lib/mail-credentials.mjs";
import { envWithCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = "cursor-monitor-admin";

const mailEnv = envWithCursorCloudflareSecrets(process.env);
const apiKey = String(mailEnv.TESTMAIL_API_KEY ?? "").trim();
const namespace = String(mailEnv.TESTMAIL_NAMESPACE ?? "").trim();

if (!apiKey || !namespace) {
  console.error(
    "TESTMAIL_API_KEY and TESTMAIL_NAMESPACE missing. Run: node website/admin/scripts/sync-testmail-cred-vault.mjs"
  );
  process.exit(1);
}

const resolvedMailEnv = await resolveLocalMailEnvAsync(mailEnv, adminDir);
const accountId = String(resolvedMailEnv.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
if (!accountId) {
  console.error("CLOUDFLARE_ACCOUNT_ID missing after resolveLocalMailEnvAsync.");
  process.exit(1);
}
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

putSecret("TESTMAIL_API_KEY", apiKey);
putSecret("TESTMAIL_NAMESPACE", namespace);

console.log("\nTestmail credentials are on Mission Control. Use Mailbox → Testmail E2E to verify outbound delivery.");
