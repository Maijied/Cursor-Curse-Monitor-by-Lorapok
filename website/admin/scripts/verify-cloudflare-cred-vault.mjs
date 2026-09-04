#!/usr/bin/env node
/**
 * Verify Cloudflare tokens in cred vault (no secret output).
 *
 * Usage: node website/admin/scripts/verify-cloudflare-cred-vault.mjs
 */
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { probeDeployToken, probeEmailSendingToken } from "./lib/mail-credentials.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const vaultFile = process.env.CRED_STORE_FILE ?? "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";

function decryptVault() {
  const passFiles = [
    resolve(repoRoot, ".cred-vault-passphrase"),
    process.env.CRED_VAULT_PASSPHRASE_FILE ??
      "/mnt/NewVolume/Personal_Projects/cred/VAULT_PASSPHRASE_READ_ONCE.txt",
  ];
  for (const file of passFiles) {
    if (!existsSync(file) && !process.env.CRED_VAULT_PASSPHRASE) continue;
    const pass = process.env.CRED_VAULT_PASSPHRASE ?? readFileSync(file, "utf8").trim();
    const dir = mkdtempSync(join(tmpdir(), "cv-"));
    const passPath = join(dir, "p");
    writeFileSync(passPath, `${pass}\n`);
    const r = spawnSync(
      "gpg",
      ["--batch", "--quiet", "--yes", "--pinentry-mode", "loopback", "--passphrase-file", passPath, "-d", vaultFile],
      { encoding: "utf8" }
    );
    rmSync(dir, { recursive: true, force: true });
    if (r.status === 0 && r.stdout) return JSON.parse(r.stdout);
  }
  return null;
}

const mask = (value) =>
  value ? `${String(value).slice(0, 4)}***${String(value).slice(-4)} (${String(value).length} chars)` : "missing";

async function probeToken(label, token, accountId) {
  if (!token) {
    console.log(`${label}: missing`);
    return { label, ok: false };
  }
  const verify = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const deploy = await probeDeployToken(token, accountId);
  const email = await probeEmailSendingToken(token, accountId);
  console.log(`${label}: ${mask(token)}`);
  console.log(`  verify: ${verify.success ? "active" : verify.errors?.[0]?.message ?? "failed"}`);
  console.log(`  deploy: ${deploy.ok ? "ok" : "fail"} (HTTP ${deploy.status}${deploy.via ? ` via ${deploy.via}` : ""})`);
  console.log(`  email: ${email.ok ? "ok" : "fail"} (HTTP ${email.status})`);
  return { label, ok: verify.success || deploy.ok };
}

const vault = decryptVault();
if (!vault) {
  console.error("Could not decrypt cred vault.");
  process.exit(1);
}

const cursor = vault.cursor ?? {};
const cloudflare = vault.cloudflare ?? {};
const accountId = cursor.cloudflare_account_id ?? cloudflare.account_id ?? "f049faaf2f67549f5c58837479596a4a";

console.log("Checking Cloudflare vault keys…\n");

const results = await Promise.all([
  probeToken("cursor.cloudfare_account_access", cursor.cloudfare_account_access, accountId),
  probeToken("cursor.cloudflare_account_access", cursor.cloudflare_account_access, accountId),
  probeToken("cursor.cloudflare_api_token", cursor.cloudflare_api_token, accountId),
  probeToken("cloudflare.api_token", cloudflare.api_token, accountId),
]);

const anyOk = results.some((r) => r.ok);
if (!anyOk) {
  console.log("\nNo working deploy token found in vault.");
  console.log("Set a long-lived token with:");
  console.log("  cred set cursor cloudflare_api_token");
  console.log("  # or alias: cred set cursor cloudfare_account_access");
  process.exit(1);
}

console.log("\nAt least one vault token passed deploy or verify checks.");
