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

/**
 * Decrypt the gpg credential vault using passphrase candidates from env/files.
 * @param {string} [vaultFile]
 * @returns {Record<string, unknown> | null}
 */
export function decryptCredentialVault(vaultFile = DEFAULT_VAULT) {
  for (const candidate of readPassphraseCandidates()) {
    const vault = gpgDecrypt(candidate, vaultFile);
    if (vault) return vault;
  }
  return null;
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

/**
 * Updates the Cursor cron secret in the credential vault.
 * @param {string} cronSecret - The cron secret to store.
 * @return {{vaultUpdated: boolean, reason?: string}} The update status and, if unsuccessful, the failure reason.
 */
export function syncCursorCronSecret(cronSecret) {
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
  vault.cursor.cron_secret = cronSecret;

  const ok = gpgEncrypt(passphrase, vault);
  return { vaultUpdated: ok, reason: ok ? undefined : "vault encrypt failed" };
}

/**
 * @param {Record<string, unknown>} vault
 */
function resolveCloudflareApiTokenFromVault(vault) {
  const cursor = /** @type {Record<string, unknown>} */ (vault?.cursor ?? {});
  const cloudflare = /** @type {Record<string, unknown>} */ (vault?.cloudflare ?? {});
  const candidates = [
    cursor.cloudfare_account_access,
    cursor.cloudflare_account_access,
    cursor.cloudflare_api_token,
    cloudflare.api_token,
    cloudflare.account_api_token,
    cursor.cloudflare_oauth_token,
  ];
  for (const value of candidates) {
    const token = String(value ?? "").trim();
    if (token) return token;
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} vault
 */
function resolveCloudflareEmailTokenFromVault(vault) {
  const cursor = /** @type {Record<string, unknown>} */ (vault?.cursor ?? {});
  const cloudflare = /** @type {Record<string, unknown>} */ (vault?.cloudflare ?? {});
  const candidates = [
    cursor.cloudflare_email_api_token,
    cloudflare.email_api_token,
    resolveCloudflareApiTokenFromVault(vault),
  ];
  for (const value of candidates) {
    const token = String(value ?? "").trim();
    if (token) return token;
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} vault
 */
function resolveCloudflareAccountIdFromVault(vault) {
  const cursor = /** @type {Record<string, unknown>} */ (vault?.cursor ?? {});
  const cloudflare = /** @type {Record<string, unknown>} */ (vault?.cloudflare ?? {});
  const cloudfare = /** @type {Record<string, unknown>} */ (vault?.cloudfare ?? {});
  return (
    String(
      cursor.cloudflare_account_id ??
        cloudflare.account_id ??
        cloudfare.account_id ??
        ""
    ).trim() || undefined
  );
}

/**
 * @param {Record<string, unknown>} vault
 */
function resolveCloudflareGlobalApiKeyFromVault(vault) {
  const cursor = /** @type {Record<string, unknown>} */ (vault?.cursor ?? {});
  const cloudflare = /** @type {Record<string, unknown>} */ (vault?.cloudflare ?? {});
  const cloudfare = /** @type {Record<string, unknown>} */ (vault?.cloudfare ?? {});
  const candidates = [
    cloudfare.cloudfare_global_api_key,
    cloudfare.global_api_key,
    cloudflare.global_api_key,
    cursor.cloudflare_global_api_key,
    cursor.cloudfare_global_api_key,
  ];
  for (const value of candidates) {
    const key = String(value ?? "").trim();
    if (key) return key;
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} vault
 */
function resolveCloudflareAccountEmailFromVault(vault) {
  const cursor = /** @type {Record<string, unknown>} */ (vault?.cursor ?? {});
  const cloudflare = /** @type {Record<string, unknown>} */ (vault?.cloudflare ?? {});
  const cloudfare = /** @type {Record<string, unknown>} */ (vault?.cloudfare ?? {});
  const candidates = [
    cursor.cloudflare_account_email,
    cursor.cloudflare_email,
    cloudflare.account_email,
    cloudflare.email,
    cloudfare.account_email,
    cloudfare.email,
  ];
  for (const value of candidates) {
    const email = String(value ?? "").trim();
    if (email) return email;
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} vault
 * @returns {string|undefined}
 */
function resolveResendApiKeyFromVault(vault) {
  const cursor = /** @type {Record<string, unknown>} */ (vault?.cursor ?? {});
  const resend = /** @type {Record<string, unknown>} */ (vault?.resend ?? {});
  const candidates = [
    cursor.resend_api_key,
    resend.resend_api_key,
    resend.resend_api,
    resend.resent_api,
  ];
  for (const value of candidates) {
    const key = String(value ?? "").trim();
    if (key.startsWith("re_")) return key;
  }
  const fallback = String(cursor.resend_api_key ?? "").trim();
  return fallback || undefined;
}

/**
 * Loads Cursor Cloudflare credentials and a GitHub token from the credential vault.
 * @return {{ apiToken?: string; emailToken?: string; accountId?: string; cronSecret?: string; githubToken?: string } | null} The normalized credentials, or `null` if no usable vault is found.
 */
export function loadCursorCloudflareSecretsFromVault() {
  const vault = decryptCredentialVault();
  if (!vault) return null;
  const cursor = /** @type {Record<string, unknown>} */ (vault.cursor ?? {});
  if (!cursor && !vault.titi && !vault.github && !vault.cloudflare && !vault.cloudfare) {
    return null;
  }
  const githubToken = resolveGithubTokenFromVault(vault);
  const apiToken = resolveCloudflareApiTokenFromVault(vault);
  const emailToken = resolveCloudflareEmailTokenFromVault(vault);
  const accountId = resolveCloudflareAccountIdFromVault(vault);
  const globalApiKey = resolveCloudflareGlobalApiKeyFromVault(vault);
  const globalApiEmail = resolveCloudflareAccountEmailFromVault(vault);
  if (!apiToken && !emailToken && !accountId && !githubToken && !globalApiKey) {
    return null;
  }
  return {
    apiToken,
    emailToken,
    accountId,
    globalApiKey,
    globalApiEmail,
    cronSecret: String(cursor.cron_secret ?? "").trim() || undefined,
    githubToken,
    resendApiKey: resolveResendApiKeyFromVault(vault),
    resendFrom: String(cursor.resend_from ?? "").trim() || undefined,
    resendSendingDomain: String(cursor.resend_sending_domain ?? "").trim() || undefined,
    mailProbeTo: String(cursor.mail_probe_to ?? "").trim() || undefined,
    testmailApiKey: String(cursor.testmail_api_key ?? "").trim() || undefined,
    testmailNamespace: String(cursor.testmail_namespace ?? "").trim() || undefined,
  };
}

/**
 * Finds the first nonempty GitHub token in the vault's recognized credential sections.
 * @param {Record<string, unknown>} vault - The vault data containing credential sections.
 * @return {string|undefined} The trimmed GitHub token, or `undefined` when none is available.
 */
function resolveGithubTokenFromVault(vault) {
  const titi = /** @type {Record<string, unknown>} */ (vault?.titi ?? {});
  const github = /** @type {Record<string, unknown>} */ (vault?.github ?? {});
  const cursor = /** @type {Record<string, unknown>} */ (vault?.cursor ?? {});
  const candidates = [
    titi.github_token,
    titi.GITHUB_TOKEN,
    titi.pat,
    github.token,
    github.pat,
    github.github_token,
    cursor.github_token,
    cursor.GITHUB_TOKEN,
  ];
  for (const value of candidates) {
    const token = String(value ?? "").trim();
    if (token) return token;
  }
  return undefined;
}

/**
 * Updates arbitrary cursor-scoped keys in the credential vault.
 * @param {Record<string, string>} fields - Key/value pairs under vault.cursor
 * @returns {{vaultUpdated: boolean, reason?: string}}
 */
export function syncCursorVaultKeys(fields) {
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
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      vault.cursor[key] = String(value);
    }
  }

  const ok = gpgEncrypt(passphrase, vault);
  return { vaultUpdated: ok, reason: ok ? undefined : "vault encrypt failed" };
}

/**
 * Updates the GitHub token in the credential vault.
 * @param {string} githubToken - The GitHub token to store.
 * @returns {{vaultUpdated: boolean, reason?: string}} The update status and an optional failure reason.
 */
export function syncCursorGithubToken(githubToken) {
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

  vault.titi = vault.titi ?? {};
  vault.titi.github_token = githubToken;
  vault.cursor = vault.cursor ?? {};
  vault.cursor.github_token = githubToken;

  const ok = gpgEncrypt(passphrase, vault);
  return { vaultUpdated: ok, reason: ok ? undefined : "vault encrypt failed" };
}

/**
 * Merges credentials loaded from the GPG vault into an environment object.
 * @param {Object} [baseEnv=process.env] - Environment variables to augment; existing values take precedence.
 * @return {Object} The environment object with missing vault credentials added, or the original object when vault loading is skipped or fails.
 */
export function envWithCursorCloudflareSecrets(baseEnv = process.env) {
  if (baseEnv.CCM_SKIP_CRED_VAULT === "1" || baseEnv.CCM_SKIP_CRED_VAULT === "true") {
    return baseEnv;
  }
  const loaded = loadCursorCloudflareSecretsFromVault();
  if (!loaded) return baseEnv;
  return {
    ...baseEnv,
    ...(loaded.accountId && !baseEnv.CLOUDFLARE_ACCOUNT_ID
      ? { CLOUDFLARE_ACCOUNT_ID: loaded.accountId }
      : {}),
    ...(loaded.apiToken && !baseEnv.CLOUDFLARE_API_TOKEN
      ? { CLOUDFLARE_API_TOKEN: loaded.apiToken }
      : {}),
    ...(loaded.emailToken && !baseEnv.CLOUDFLARE_EMAIL_API_TOKEN
      ? { CLOUDFLARE_EMAIL_API_TOKEN: loaded.emailToken }
      : {}),
    ...(loaded.cronSecret && !baseEnv.CRON_SECRET ? { CRON_SECRET: loaded.cronSecret } : {}),
    ...(loaded.githubToken && !baseEnv.GITHUB_TOKEN ? { GITHUB_TOKEN: loaded.githubToken } : {}),
    ...(loaded.resendApiKey && !baseEnv.RESEND_API_KEY ? { RESEND_API_KEY: loaded.resendApiKey } : {}),
    ...(loaded.resendFrom && !baseEnv.RESEND_FROM ? { RESEND_FROM: loaded.resendFrom } : {}),
    ...(loaded.testmailApiKey && !baseEnv.TESTMAIL_API_KEY ? { TESTMAIL_API_KEY: loaded.testmailApiKey } : {}),
    ...(loaded.testmailNamespace && !baseEnv.TESTMAIL_NAMESPACE
      ? { TESTMAIL_NAMESPACE: loaded.testmailNamespace }
      : {}),
    ...(loaded.globalApiKey && !baseEnv.CLOUDFLARE_API_KEY
      ? { CLOUDFLARE_API_KEY: loaded.globalApiKey }
      : {}),
    ...(loaded.globalApiEmail && !baseEnv.CLOUDFLARE_EMAIL
      ? { CLOUDFLARE_EMAIL: loaded.globalApiEmail }
      : {}),
  };
}
