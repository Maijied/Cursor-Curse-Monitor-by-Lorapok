import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_VAULT =
  process.env.CRED_STORE_FILE ?? "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";
const DEFAULT_PASS_FILE =
  process.env.CRED_VAULT_PASSPHRASE_FILE ??
  "/mnt/NewVolume/Personal_Projects/cred/VAULT_PASSPHRASE_READ_ONCE.txt";

function readPassphrase() {
  try {
    const raw = readFileSync(DEFAULT_PASS_FILE, "utf8").trim();
    return raw.split(/\r?\n/)[0]?.trim() ?? "";
  } catch {
    return "";
  }
}

function withPassphraseFile(passphrase, fn) {
  const dir = mkdtempSync(join(tmpdir(), "cred-pass-"));
  const passPath = join(dir, "pass");
  writeFileSync(passPath, `${passphrase}\n`, { mode: 0o600 });
  try {
    return fn(passPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function gpgDecrypt(passphrase, vaultFile = DEFAULT_VAULT) {
  return withPassphraseFile(passphrase, (passPath) => {
    const r = spawnSync(
      "gpg",
      [
        "--batch",
        "--quiet",
        "--yes",
        "--pinentry-mode",
        "loopback",
        "--passphrase-file",
        passPath,
        "-d",
        vaultFile,
      ],
      { encoding: "utf8" }
    );
    if (r.status !== 0 || !r.stdout.trim()) return null;
    try {
      return JSON.parse(r.stdout);
    } catch {
      return null;
    }
  });
}

function gpgEncrypt(passphrase, data, vaultFile = DEFAULT_VAULT) {
  return withPassphraseFile(passphrase, (passPath) => {
    const r = spawnSync(
      "gpg",
      [
        "--batch",
        "--quiet",
        "--yes",
        "--pinentry-mode",
        "loopback",
        "--passphrase-file",
        passPath,
        "-c",
        "--cipher-algo",
        "AES256",
        "-o",
        vaultFile,
      ],
      { input: JSON.stringify(data), encoding: "utf8" }
    );
    return r.status === 0;
  });
}

/** @param {{ apiToken: string; emailToken?: string; accountId: string }} opts */
export function syncCursorCloudflareSecrets({ apiToken, emailToken, accountId }) {
  const passphrase = readPassphrase();
  if (!passphrase) {
    return { vaultUpdated: false, reason: "passphrase file missing" };
  }

  const vault = gpgDecrypt(passphrase);
  if (!vault) {
    return { vaultUpdated: false, reason: "vault decrypt failed" };
  }

  vault.cursor = vault.cursor ?? {};
  vault.cursor.cloudflare_api_token = apiToken;
  vault.cursor.cloudflare_email_api_token = emailToken ?? apiToken;
  vault.cursor.cloudflare_account_id = accountId;

  const ok = gpgEncrypt(passphrase, vault);
  return { vaultUpdated: ok, reason: ok ? undefined : "vault encrypt failed" };
}
