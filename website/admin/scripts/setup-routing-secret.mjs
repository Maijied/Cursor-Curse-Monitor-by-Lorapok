#!/usr/bin/env node
/**
 * Sync CLOUDFLARE_ROUTING_API_TOKEN to Pages so Mission Control → Mail → Sync routing works.
 *
 * Requires wrangler OAuth (npx wrangler login) or CLOUDFLARE_API_TOKEN with Email Routing Edit.
 *
 *   cd website/admin && node scripts/setup-routing-secret.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLocalMailEnvAsync } from "./lib/resolve-local-mail-env.mjs";
import { pickDeployAuth, wranglerDeployEnv } from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "f049faaf2f67549f5c58837479596a4a";
const project = "cursor-monitor-admin";

async function createRoutingToken(oauth, acctId) {
  const pgRes = await fetch(
    "https://api.cloudflare.com/client/v4/user/tokens/permission_groups",
    { headers: { Authorization: `Bearer ${oauth}` } }
  );
  const pgJson = await pgRes.json();
  if (!pgRes.ok) {
    throw new Error(`permission_groups ${pgRes.status}: ${JSON.stringify(pgJson.errors)}`);
  }

  const names = new Set([
    "Email Routing Rules Edit",
    "Email Routing Rules Read",
    "Email Routing Edit",
    "Zone Read",
    "Account Settings Read",
  ]);
  const groups = pgJson.result.filter((g) => names.has(g.name));
  if (!groups.length) {
    throw new Error("No Email Routing permission groups found — use wrangler OAuth token directly");
  }

  const tokenBody = {
    name: `ccm-inbound-routing-${Date.now()}`,
    policies: [
      {
        effect: "allow",
        resources: {
          [`com.cloudflare.api.account.${acctId}`]: "*",
          "com.cloudflare.api.account.zone.*": "*",
        },
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

const mailEnv = await resolveLocalMailEnvAsync(process.env, adminDir);
const { auth, probe } = await pickDeployAuth(mailEnv);
if (!probe?.ok) {
  console.error("No valid Cloudflare credentials. Run: cd website/admin && npx wrangler login");
  process.exit(1);
}

let routingToken = mailEnv.CLOUDFLARE_ROUTING_API_TOKEN?.trim() || mailEnv.CLOUDFLARE_API_TOKEN?.trim();
if (!routingToken) {
  const oauth = auth.type === "bearer" ? auth.token : null;
  if (!oauth) {
    console.error("Need bearer OAuth or CLOUDFLARE_API_TOKEN to create routing token.");
    process.exit(1);
  }
  try {
    routingToken = await createRoutingToken(oauth, accountId);
    console.log("Created scoped CLOUDFLARE_ROUTING_API_TOKEN (Email Routing Edit).");
  } catch (err) {
    console.warn(`${err instanceof Error ? err.message : err} — using OAuth token for Pages secret.`);
    routingToken = oauth;
  }
}

const wranglerEnv = wranglerDeployEnv(accountId, auth, mailEnv);

function putPagesSecret(name, value) {
  const result = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", name, "--project-name", project],
    {
      cwd: adminDir,
      input: value,
      encoding: "utf8",
      env: wranglerEnv,
    }
  );
  if (result.status !== 0) {
    console.error(`Failed to set Pages secret ${name}`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ Pages secret ${name} updated`);
}

putPagesSecret("CLOUDFLARE_ROUTING_API_TOKEN", routingToken);

const gh = spawnSync(
  "gh",
  ["secret", "set", "CLOUDFLARE_ROUTING_API_TOKEN", "--env", "admin-production"],
  { input: routingToken, encoding: "utf8" }
);
if (gh.status === 0) {
  console.log("✓ GitHub admin-production CLOUDFLARE_ROUTING_API_TOKEN synced");
} else {
  console.warn("GitHub secret sync skipped (gh unavailable or not authenticated).");
}

console.log("\nDone. Redeploy Mission Control, then Mail → Sync routing to provision inbound forwards.");
