#!/usr/bin/env node
/**
 * Create Email Sending API token and sync to GitHub + Pages (no secret output).
 */
import { spawnSync } from "node:child_process";
import { syncCursorCloudflareSecrets } from "./lib/cred-vault-sync.mjs";
import { createMailToken, probe } from "./lib/mail-token-factory.mjs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const adminDir = new URL("..", import.meta.url).pathname;

function wranglerOAuth() {
  const r = spawnSync("npx", ["wrangler", "auth", "token", "--json"], {
    encoding: "utf8",
    cwd: adminDir,
  });
  const text = `${r.stdout}\n${r.stderr}`;
  const match = text.match(/\{[\s\S]*"token"[\s\S]*\}/);
  if (!match) throw new Error("wrangler auth token failed");
  return JSON.parse(match[0]).token;
}

function ghSecretSet(token) {
  const r = spawnSync(
    "gh",
    ["secret", "set", "CLOUDFLARE_EMAIL_API_TOKEN", "--env", "admin-production"],
    { input: token, encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(`gh secret set failed: ${r.stderr}`);
  }
}

function pagesSecretPut(token) {
  const r = spawnSync(
    "npx",
    [
      "wrangler",
      "pages",
      "secret",
      "put",
      "CLOUDFLARE_EMAIL_API_TOKEN",
      "--project-name=cursor-monitor-admin",
    ],
    {
      cwd: adminDir,
      input: token,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_API_TOKEN: token,
      },
      encoding: "utf8",
    }
  );
  if (r.status !== 0) {
    throw new Error(`pages secret put failed: ${r.stderr}`);
  }
}

const oauth = wranglerOAuth();
let mailToken;
let deployToken;

try {
  deployToken = await createMailToken(oauth, accountId);
  mailToken = deployToken;
  console.log("Created dedicated API token (Workers + Pages + Email Sending)");
} catch (e) {
  console.warn(`API token create failed (${e.message}); using OAuth token for secrets`);
  mailToken = oauth;
  deployToken = oauth;
}

const probeResult = await probe(mailToken, accountId);
console.log(JSON.stringify({ probe: probeResult }));
if (!probeResult.success && probeResult.status !== 200) {
  process.exit(1);
}

function ghDeploySecretSet(token) {
  const r = spawnSync(
    "gh",
    ["secret", "set", "CLOUDFLARE_API_TOKEN", "--env", "admin-production"],
    { input: token, encoding: "utf8" }
  );
  if (r.status !== 0) {
    throw new Error(`gh secret set CLOUDFLARE_API_TOKEN failed: ${r.stderr}`);
  }
}

ghSecretSet(mailToken);
console.log("GitHub secret CLOUDFLARE_EMAIL_API_TOKEN set (admin-production)");

pagesSecretPut(mailToken);
console.log("Pages secret CLOUDFLARE_EMAIL_API_TOKEN synced");

const deployProbe = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/services/ccm-mail-relay`,
  { headers: { Authorization: `Bearer ${deployToken}` } }
);
if (deployProbe.status === 401 || deployProbe.status === 403) {
  console.warn(
    "Deploy token cannot read Workers API — add Account → Workers Scripts → Edit to CLOUDFLARE_API_TOKEN or re-run after cred vault sync."
  );
} else {
  ghDeploySecretSet(deployToken);
  console.log("GitHub secret CLOUDFLARE_API_TOKEN set (admin-production)");
}

const vaultResult = syncCursorCloudflareSecrets({
  apiToken: deployToken,
  emailToken: mailToken,
  accountId,
});
if (vaultResult.vaultUpdated) {
  console.log("cred vault updated: cursor/cloudflare_api_token + cloudflare_email_api_token");
} else {
  console.warn(`cred vault not updated (${vaultResult.reason})`);
}

console.log("Done.");
