#!/usr/bin/env node
/**
 * Sync encrypted cred vault blob + passphrase pin to GitHub admin-production secrets.
 * CI decrypts with CRED_VAULT_PASSPHRASE and loads Cloudflare credentials at deploy time.
 *
 * Usage:
 *   export CRED_VAULT_PASSPHRASE=...   # or .cred-vault-passphrase at repo root
 *   node website/admin/scripts/sync-cred-vault-github.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const vaultFile =
  process.env.CRED_STORE_FILE ?? "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";

function readPassphrase() {
  if (process.env.CRED_VAULT_PASSPHRASE?.trim()) return process.env.CRED_VAULT_PASSPHRASE.trim();
  if (process.env.CRED_PASSPHRASE?.trim()) return process.env.CRED_PASSPHRASE.trim();
  for (const file of [
    resolve(repoRoot, ".cred-vault-passphrase"),
    resolve(repoRoot, "website/admin/.cred-vault-passphrase"),
  ]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8").trim();
    if (line) return line;
  }
  return "";
}

function ghSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "--env", "admin-production"], {
    input: value,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`gh secret set ${name} failed`);
  console.log(`GitHub secret ${name} updated (admin-production)`);
}

if (!existsSync(vaultFile)) {
  console.error(`::error::Vault file not found: ${vaultFile}`);
  process.exit(1);
}

const passphrase = readPassphrase();
if (!passphrase) {
  console.error("::error::CRED_VAULT_PASSPHRASE or .cred-vault-passphrase required.");
  process.exit(1);
}

const b64 = readFileSync(vaultFile).toString("base64");
ghSecret("CRED_STORE_GPG_BASE64", b64);
ghSecret("CRED_VAULT_PASSPHRASE", passphrase);

console.log("Done — CI can decrypt cred vault with CRED_VAULT_PASSPHRASE pin.");
console.log("Run: node website/admin/scripts/load-cred-vault-env-ci.mjs (local dry-run with GITHUB_ENV unset)");
