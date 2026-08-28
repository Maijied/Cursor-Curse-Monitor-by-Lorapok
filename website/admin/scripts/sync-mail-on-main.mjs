#!/usr/bin/env node
/**
 * Mail setup gate for push/merge to main.
 *
 * CI (admin-deploy on main): uses GitHub secrets only — enable-mail + verify-mail-transport.
 * Local vault sync (optional): create a gitignored `.cred-vault-passphrase` file, then:
 *   node website/admin/scripts/sync-mail-on-main.mjs --vault
 *
 * Usage:
 *   node scripts/sync-mail-on-main.mjs          # CI auto-detects GITHUB_ACTIONS
 *   node scripts/sync-mail-on-main.mjs --ci     # force CI mode (no vault)
 *   node scripts/sync-mail-on-main.mjs --vault    # local: vault → gh/pages, then enable + verify
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { envWithCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const adminDir = resolve(scriptDir, "..");
const repoRoot = resolve(scriptDir, "../../..");

const args = process.argv.slice(2);
const forceVault = args.includes("--vault");
const forceCi = args.includes("--ci");
const inCi = forceCi || process.env.GITHUB_ACTIONS === "true";

const LOCAL_PASSPHRASE_FILES = [
  resolve(repoRoot, ".cred-vault-passphrase"),
  resolve(repoRoot, "website/admin/.cred-vault-passphrase"),
];

function runNode(scriptName, env = process.env) {
  const path = resolve(scriptDir, scriptName);
  const result = spawnSync(process.execPath, [path], {
    stdio: "inherit",
    env,
    cwd: adminDir,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function envWithVaultTokens(baseEnv = process.env) {
  return envWithCursorCloudflareSecrets(baseEnv);
}

function hasLocalPassphrase() {
  if ((process.env.CRED_VAULT_PASSPHRASE ?? "").trim()) return true;
  return LOCAL_PASSPHRASE_FILES.some((file) => existsSync(file));
}

if (!inCi && forceVault) {
  if (!hasLocalPassphrase()) {
    console.error(
      "Missing local passphrase. Create one of these gitignored files (single line, no quotes):\n" +
        "  .cred-vault-passphrase\n" +
        "  website/admin/.cred-vault-passphrase\n" +
        "Or export CRED_VAULT_PASSPHRASE for this shell only."
    );
    process.exit(1);
  }
  console.log("Local: syncing cred vault → GitHub/Pages secrets…");
  runNode("sync-mail-cred-vault.mjs");
  process.env = envWithVaultTokens(process.env);
} else if (!inCi && !forceVault) {
  console.log(
    "ℹ️  Local mode: skipping vault sync (use --vault with .cred-vault-passphrase to refresh secrets)."
  );
}

console.log("\n=== enable-mail ===");
runNode("enable-mail.mjs", envWithVaultTokens(process.env));

console.log("\n=== verify-mail-transport ===");
runNode("verify-mail-transport.mjs", envWithVaultTokens(process.env));

console.log("\n✓ sync-mail-on-main complete");
