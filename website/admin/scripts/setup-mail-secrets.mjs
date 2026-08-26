#!/usr/bin/env node
/**
 * Create Email Sending API token and sync to GitHub + Pages (no secret output).
 */
import { spawnSync } from "node:child_process";

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

async function createMailToken(oauth) {
  // Resolve permission group IDs dynamically
  const pgRes = await fetch(
    "https://api.cloudflare.com/client/v4/user/tokens/permission_groups",
    { headers: { Authorization: `Bearer ${oauth}` } }
  );
  const pgJson = await pgRes.json();
  if (!pgRes.ok) {
    throw new Error(`permission_groups ${pgRes.status}: ${JSON.stringify(pgJson.errors)}`);
  }

  const names = new Set([
    "Email Sending Send",
    "Email Sending Write",
    "Workers Scripts Edit",
    "Workers Scripts Read",
    "Pages Write",
    "Account Settings Read",
  ]);
  const groups = pgJson.result.filter((g) => names.has(g.name));
  if (!groups.length) {
    throw new Error("No matching permission groups found");
  }

  const tokenBody = {
    name: `ccm-mail-${Date.now()}`,
    policies: [
      {
        effect: "allow",
        resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        permission_groups: groups.map((g) => ({ id: g.id })),
      },
    ],
  };

  const res = await fetch("https://api.cloudflare.com/client/v4/user/tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${oauth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tokenBody),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`create token ${res.status}: ${JSON.stringify(json.errors)}`);
  }
  return json.result.value;
}

async function probe(token) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: "mdshuvo40@gmail.com",
        from: { address: "cursor-contact@lorapok.tech", name: "CCM Setup" },
        subject: "CCM mail token configured",
        text: "Cloudflare Email Sending is now wired for Mission Control.",
      }),
    }
  );
  const body = await res.json().catch(() => ({}));
  return { status: res.status, success: body.success, errors: body.errors };
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
  deployToken = await createMailToken(oauth);
  mailToken = deployToken;
  console.log("Created dedicated API token (Workers + Pages + Email Sending)");
} catch (e) {
  console.warn(`API token create failed (${e.message}); using OAuth token for secrets`);
  mailToken = oauth;
  deployToken = oauth;
}

const probeResult = await probe(mailToken);
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

console.log("Done.");
