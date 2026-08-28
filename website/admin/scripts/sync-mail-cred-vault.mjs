#!/usr/bin/env node
/**
 * Sync mail tokens to cred vault + GitHub + Pages (no secret output).
 */
import { spawnSync } from "node:child_process";
import { syncCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";
import { probeDeployToken, tryWranglerOAuthToken } from "./lib/mail-credentials.mjs";
import { createMailToken, probe } from "./lib/mail-token-factory.mjs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const adminDir = new URL("..", import.meta.url).pathname;

function wranglerOAuth() {
  const token = tryWranglerOAuthToken(adminDir);
  if (!token) throw new Error("wrangler auth token failed — run: cd website/admin && npx wrangler login");
  return token;
}

function ghSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "--env", "admin-production"], {
    input: value,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`gh secret set ${name} failed`);
}

function pagesSecret(value, deployToken) {
  const r = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", "CLOUDFLARE_EMAIL_API_TOKEN", "--project-name=cursor-monitor-admin"],
    {
      cwd: adminDir,
      input: value,
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: deployToken },
      encoding: "utf8",
    }
  );
  if (r.status !== 0) throw new Error("pages secret put failed");
}

const oauth = wranglerOAuth();
let token;
try {
  token = await createMailToken(oauth, accountId);
  console.log("Created long-lived API token (Workers + Pages + Email Sending)");
} catch (e) {
  console.warn(`Token create via API failed (${e.message}); using wrangler OAuth token`);
  token = oauth;
}

const probeResult = await probe(token, accountId);
console.log(JSON.stringify({ probe: { status: probeResult.status, success: probeResult.success } }));
if (!probeResult.success && probeResult.status !== 200) process.exit(1);

ghSecret("CLOUDFLARE_EMAIL_API_TOKEN", token);
pagesSecret(token, token);
console.log("GitHub CLOUDFLARE_EMAIL_API_TOKEN synced");
console.log("Pages CLOUDFLARE_EMAIL_API_TOKEN synced");

const deployProbe = await probeDeployToken(token, accountId);
if (deployProbe.ok) {
  ghSecret("CLOUDFLARE_API_TOKEN", token);
  console.log(`GitHub CLOUDFLARE_API_TOKEN synced (${deployProbe.via ?? "probe"})`);
} else {
  console.warn(
    `Skipping CLOUDFLARE_API_TOKEN sync (deploy probe HTTP ${deployProbe.status}). ` +
      "Create a Pages Write API token in Cloudflare dashboard, then re-run this script."
  );
}

const vaultResult = syncCursorCloudflareSecrets({
  apiToken: token,
  emailToken: token,
  accountId,
});
if (vaultResult.vaultUpdated) {
  console.log("cred vault updated: cursor/cloudflare_api_token + cloudflare_email_api_token");
} else {
  console.warn(`cred vault not updated (${vaultResult.reason})`);
}
