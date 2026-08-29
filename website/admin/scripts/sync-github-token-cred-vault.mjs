#!/usr/bin/env node
/**
 * Sync GITHUB_TOKEN from gpg cred vault → Cloudflare Pages (Mission Control runtime).
 *
 * Vault keys (first match wins): titi.github_token, titi.GITHUB_TOKEN, titi.pat,
 * github.token, cursor.github_token.
 *
 * Store a new PAT with: cred set titi github_token
 * Required scopes (classic): repo + workflow (or fine-grained: Actions read/write, Metadata read).
 */
import { spawnSync } from "node:child_process";
import { envWithCursorCloudflareSecrets, loadCursorCloudflareSecretsFromVault } from "./lib/cred-vault-sync.mjs";
import { pickDeployToken, probeDeployToken, tryWranglerOAuthToken } from "./lib/mail-credentials.mjs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const adminDir = new URL("..", import.meta.url).pathname;

/**
 * Stores the GitHub token as a Cloudflare Pages secret.
 * @param {string} githubToken - The GitHub token to store.
 * @param {string} [deployToken] - The Cloudflare API token used for deployment authentication.
 * @throws {Error} If the secret upload fails.
 */
function pagesSecret(githubToken, deployToken) {
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId };
  if (deployToken) env.CLOUDFLARE_API_TOKEN = deployToken;
  else delete env.CLOUDFLARE_API_TOKEN;
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", "GITHUB_TOKEN", "--project-name=cursor-monitor-admin"],
    {
      cwd: adminDir,
      input: githubToken,
      env,
      encoding: "utf8",
    }
  );
  if (r.status !== 0) {
    throw new Error(`pages secret put GITHUB_TOKEN failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * Checks whether a GitHub token is accepted by the repository tags API.
 * @param {string} token - The GitHub bearer token to validate.
 * @return {{ok: boolean, status: number}} The request success status and HTTP status code.
 */
async function probeGithubToken(token) {
  const res = await fetch("https://api.github.com/repos/Maijied/Cursor-Curse-Monitor-by-Lorapok/tags?per_page=1", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "cursor-monitor-admin-sync",
    },
  });
  return { ok: res.ok, status: res.status };
}

const loaded = loadCursorCloudflareSecretsFromVault();
const githubToken = loaded?.githubToken;
if (!githubToken) {
  console.error(
    "No github token in cred vault. Store one with:\n" +
      "  cred set titi github_token\n" +
      "Keys read: titi.github_token, titi.GITHUB_TOKEN, github.token, cursor.github_token"
  );
  process.exit(1);
}

const probe = await probeGithubToken(githubToken);
console.log(JSON.stringify({ githubTagsProbe: { status: probe.status, ok: probe.ok } }));
if (!probe.ok) {
  console.error(
    `GitHub rejected the vault token (HTTP ${probe.status}). ` +
      "Create a new PAT with repo + workflow (or Actions read/write) and run: cred set titi github_token"
  );
  process.exit(1);
}

/**
 * Resolves the Cloudflare deployment credential and its authentication source.
 * @return {Promise<{token: string, via: string}|null>} The deployment token and source, or `null` when no credential is available.
 */
async function resolveDeployToken() {
  const oauth = tryWranglerOAuthToken(adminDir);
  if (oauth) {
    const probe = await probeDeployToken(oauth, accountId);
    if (probe.ok) return { token: oauth, via: "wrangler-oauth" };
  }
  const picked = await pickDeployToken(envWithCursorCloudflareSecrets(process.env));
  if (picked.probe.ok) return { token: picked.token, via: picked.probe.via ?? "vault" };
  if (oauth) return { token: oauth, via: "wrangler-oauth-fallback" };
  const fallback = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (fallback) return { token: fallback, via: "env" };
  return null;
}

const deploy = await resolveDeployToken();
if (!deploy?.token) {
  console.error("Need Cloudflare deploy auth: cd website/admin && npx wrangler login");
  process.exit(1);
}
console.log(JSON.stringify({ cloudflareDeployAuth: deploy.via }));

pagesSecret(githubToken, deploy.token);
console.log("Pages secret GITHUB_TOKEN synced from cred vault (cursor.github_token)");
