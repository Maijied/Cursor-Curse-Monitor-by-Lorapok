#!/usr/bin/env node
/**
 * Push Cloudflare tokens from cred vault → GitHub admin-production (+ Pages email secret).
 * Does not create new API tokens — use after updating vault manually.
 *
 * Usage:
 *   node website/admin/scripts/sync-cloudflare-cred-vault.mjs
 */
import { spawnSync } from "node:child_process";
import { loadCursorCloudflareSecretsFromVault } from "./lib/cred-vault-sync.mjs";
import {
  pickDeployAuth,
  probeDeployToken,
  probeEmailSendingToken,
  tryWranglerOAuthToken,
  wranglerDeployEnv,
} from "./lib/mail-credentials.mjs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const adminDir = new URL("..", import.meta.url).pathname;

function ghSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "--env", "admin-production"], {
    input: value,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`gh secret set ${name} failed`);
}

function pagesSecret(name, value, deployEnv) {
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", name, "--project-name=cursor-monitor-admin"],
    {
      cwd: adminDir,
      input: value,
      env: { ...process.env, ...deployEnv },
      encoding: "utf8",
    }
  );
  if (r.status !== 0) throw new Error(`pages secret put ${name} failed`);
}

async function probeEmailToken(emailToken, accountId) {
  const result = await probeEmailSendingToken(emailToken, accountId);
  return { ok: result.ok, status: result.status };
}

const loaded = loadCursorCloudflareSecretsFromVault();
const vaultAccountId = loaded?.accountId ?? accountId;
const vaultApi = loaded?.apiToken?.trim() ?? "";
const vaultEmail = loaded?.emailToken?.trim() ?? vaultApi;
const vaultGlobalKey = loaded?.globalApiKey?.trim() ?? "";
const vaultGlobalEmail = loaded?.globalApiEmail?.trim() ?? "";

let deployAuth = null;
let deployVia = "none";

const baseEnv = {
  ...process.env,
  CLOUDFLARE_ACCOUNT_ID: vaultAccountId,
  ...(vaultApi ? { CLOUDFLARE_API_TOKEN: vaultApi } : {}),
  ...(vaultGlobalKey ? { CLOUDFLARE_API_KEY: vaultGlobalKey } : {}),
  ...(vaultGlobalEmail ? { CLOUDFLARE_EMAIL: vaultGlobalEmail } : {}),
};

if (vaultApi) {
  const vaultDeployProbe = await probeDeployToken(vaultApi, vaultAccountId);
  console.log(
    JSON.stringify({
      vaultDeployProbe: { ok: vaultDeployProbe.ok, status: vaultDeployProbe.status, via: vaultDeployProbe.via },
    })
  );
  if (vaultDeployProbe.ok) {
    deployAuth = { type: "bearer", token: vaultApi };
    deployVia = "vault-api-token";
  } else if (vaultDeployProbe.status === 401 || vaultDeployProbe.status === 403) {
    console.warn("Vault cloudflare_api_token is invalid or lacks Pages/Workers access.");
  }
}

if (!deployAuth) {
  const picked = await pickDeployAuth(baseEnv);
  if (picked.probe.ok && picked.auth) {
    deployAuth = picked.auth;
    deployVia = picked.probe.via ?? "picked";
  }
}

const oauth = tryWranglerOAuthToken(adminDir);
if (!deployAuth && oauth) {
  const oauthProbe = await probeDeployToken(oauth, vaultAccountId);
  console.log(JSON.stringify({ wranglerOAuthProbe: { ok: oauthProbe.ok, status: oauthProbe.status } }));
  if (oauthProbe.ok) {
    deployAuth = { type: "bearer", token: oauth };
    deployVia = "wrangler-oauth";
  }
}

if (!deployAuth) {
  console.error(
    "No working Cloudflare deploy credential. Update cred vault (global key or API token) or run: cd website/admin && npx wrangler login"
  );
  process.exit(1);
}

console.log(JSON.stringify({ deployAuth: deployVia, mode: deployAuth.type }));

const deployEnv = wranglerDeployEnv(vaultAccountId, deployAuth, process.env);

if (deployAuth.type === "bearer") {
  ghSecret("CLOUDFLARE_API_TOKEN", deployAuth.token);
  console.log("GitHub CLOUDFLARE_API_TOKEN synced");
} else {
  ghSecret("CLOUDFLARE_API_KEY", deployAuth.apiKey);
  ghSecret("CLOUDFLARE_EMAIL", deployAuth.email);
  console.log("GitHub CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL synced");
}
ghSecret("CLOUDFLARE_ACCOUNT_ID", vaultAccountId);
console.log("GitHub CLOUDFLARE_ACCOUNT_ID synced");

const emailCandidates = [
  ...new Set([
    vaultEmail,
    vaultApi,
    deployAuth.type === "bearer" ? deployAuth.token : "",
  ].filter(Boolean)),
];
let emailToken = "";
for (const candidate of emailCandidates) {
  const emailProbe = await probeEmailToken(candidate, vaultAccountId);
  console.log(JSON.stringify({ emailProbe: { ok: emailProbe.ok, status: emailProbe.status, candidate: "masked" } }));
  if (emailProbe.ok) {
    emailToken = candidate;
    break;
  }
}

if (emailToken) {
  ghSecret("CLOUDFLARE_EMAIL_API_TOKEN", emailToken);
  console.log("GitHub CLOUDFLARE_EMAIL_API_TOKEN synced");
  pagesSecret("CLOUDFLARE_EMAIL_API_TOKEN", emailToken, deployEnv);
  console.log("Pages CLOUDFLARE_EMAIL_API_TOKEN synced");
} else {
  console.warn("Email token probe did not pass — mail may still work via ccm-mail-relay service binding.");
}

console.log("Done — Cloudflare deploy credentials propagated to GitHub.");
