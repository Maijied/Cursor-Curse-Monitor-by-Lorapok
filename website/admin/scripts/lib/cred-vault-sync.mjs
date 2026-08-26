import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_VAULT =
  process.env.CRED_STORE_FILE ?? "/mnt/NewVolume/Personal_Projects/cred/credentials.json.gpg";
const DEFAULT_PASS_FILE =
  process.env.CRED_VAULT_PASSPHRASE_FILE ??
  "/mnt/NewVolume/Personal_Projects/cred/VAULT_PASSPHRASE_READ_ONCE.txt";

const LOCAL_PASSPHRASE_FILES = [
  resolve(repoRoot, ".cred-vault-passphrase"),
  resolve(repoRoot, "website/admin/.cred-vault-passphrase"),
];

function parsePassphraseFile(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsed = [];

  const labeled = raw.match(/^Passphrase:\s*(.+)$/m);
  if (labeled?.[1]) parsed.push(labeled[1].trim());

  for (const line of lines) {
    if (/^passphrase:/i.test(line)) {
      const inline = line.replace(/^passphrase:\s*/i, "").trim();
      if (inline) parsed.push(inline);
    }
    if (
      line &&
      !/^one-time/i.test(line) &&
      !/^vault:/i.test(line) &&
      !/^created:/i.test(line) &&
      !/^passphrase:?$/i.test(line)
    ) {
      parsed.push(line);
    }
  }

  return parsed;
}

function readPassphraseCandidates() {
  const fromEnv = (process.env.CRED_VAULT_PASSPHRASE ?? "").trim();
  const out = fromEnv ? [fromEnv] : [];

  for (const file of LOCAL_PASSPHRASE_FILES) {
    if (!existsSync(file)) continue;
    try {
      out.push(...parsePassphraseFile(readFileSync(file, "utf8").trim()));
    } catch {
      /* ignore unreadable local file */
    }
  }

  try {
    out.push(...parsePassphraseFile(readFileSync(DEFAULT_PASS_FILE, "utf8").trim()));
  } catch {
    /* external passphrase file optional */
  }

  return [...new Set(out.filter(Boolean))];
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
  const candidates = readPassphraseCandidates();
  if (!candidates.length) {
    return { vaultUpdated: false, reason: "passphrase missing (.cred-vault-passphrase or CRED_VAULT_PASSPHRASE)" };
  }

  let vault = null;
  let passphrase = "";
  for (const candidate of candidates) {
    vault = gpgDecrypt(candidate);
    if (vault) {
      passphrase = candidate;
      break;
    }
  }
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
