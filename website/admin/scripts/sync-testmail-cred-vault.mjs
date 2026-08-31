#!/usr/bin/env node
/**
 * Store testmail.app credentials in cred vault (no secret output).
 *
 *   node website/admin/scripts/sync-testmail-cred-vault.mjs
 *
 * Optional one-time seed from console quickstart link (apikey + namespace in query):
 *   TESTMAIL_QUICKSTART_URL='https://api.testmail.app/api/json?apikey=...&namespace=61z27' \
 *     node website/admin/scripts/sync-testmail-cred-vault.mjs
 */
import { syncCursorVaultKeys, loadCursorCloudflareSecretsFromVault } from "./lib/cred-vault-sync.mjs";

function fromQuickstartUrl(raw) {
  if (!raw?.trim()) return {};
  try {
    const url = new URL(raw.trim());
    return {
      apiKey: url.searchParams.get("apikey") ?? "",
      namespace: url.searchParams.get("namespace") ?? "",
    };
  } catch {
    return {};
  }
}

const quick = fromQuickstartUrl(process.env.TESTMAIL_QUICKSTART_URL);
const apiKey = String(process.env.TESTMAIL_API_KEY ?? quick.apiKey ?? "").trim();
const namespace = String(process.env.TESTMAIL_NAMESPACE ?? quick.namespace ?? "").trim();

const existing = loadCursorCloudflareSecretsFromVault();
const fields = {};
if (apiKey) fields.testmail_api_key = apiKey;
else if (existing?.testmailApiKey) fields.testmail_api_key = existing.testmailApiKey;

if (namespace) fields.testmail_namespace = namespace;
else if (existing?.testmailNamespace) fields.testmail_namespace = existing.testmailNamespace;

if (!fields.testmail_api_key || !fields.testmail_namespace) {
  console.error(
    "Need testmail credentials. Set TESTMAIL_API_KEY + TESTMAIL_NAMESPACE, or TESTMAIL_QUICKSTART_URL from console."
  );
  process.exit(1);
}

const result = syncCursorVaultKeys(fields);
if (!result.vaultUpdated) {
  console.error(`cred vault update failed: ${result.reason ?? "unknown"}`);
  process.exit(1);
}

console.log("✓ cred vault updated: cursor/testmail_api_key + testmail_namespace");
