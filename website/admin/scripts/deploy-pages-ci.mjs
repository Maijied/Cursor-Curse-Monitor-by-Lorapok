#!/usr/bin/env node
/**
 * CI-only Cloudflare Pages deploy with MAIL_RELAY binding guard and auth retries.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pickDeployToken, resolveMailCredentials } from "./lib/mail-credentials.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { accountId } = resolveMailCredentials();
const relayDeployed = process.env.MAIL_RELAY_DEPLOYED === "true";
const relayExists =
  process.env.MAIL_RELAY_EXISTS_SETUP === "true" ||
  process.env.MAIL_RELAY_EXISTS_VERIFY === "true";

if (!accountId) {
  console.error("::error::CLOUDFLARE_ACCOUNT_ID is required.");
  process.exit(1);
}

const { token: deployToken, probe } = await pickDeployToken();
if (!deployToken) {
  console.error("::error::CLOUDFLARE_API_TOKEN (or CLOUDFLARE_EMAIL_API_TOKEN) is required.");
  process.exit(1);
}

if (probe.ok) {
  console.log(`::notice::Using deploy token (${probe.via ?? "probe"} HTTP ${probe.status}).`);
} else if (probe.via?.includes("rate-limit")) {
  console.error(
    `::error::Cloudflare API rate-limited deploy token probe (HTTP ${probe.status}). ` +
      "Wait a few minutes and rerun, or refresh CLOUDFLARE_API_TOKEN in admin-production."
  );
  process.exit(1);
} else {
  console.error(
    `::error::No valid deploy token (HTTP ${probe.status}). ` +
      "Refresh GitHub admin-production secret CLOUDFLARE_API_TOKEN with a Cloudflare API token that has Account → Cloudflare Pages → Edit."
  );
  process.exit(1);
}

const wranglerToml = resolve(adminDir, "wrangler.toml");
if (!relayDeployed && !relayExists) {
  const text = readFileSync(wranglerToml, "utf8");
  const withoutServices = text.replace(
    /\n# Mission Control calls ccm-mail-relay[\s\S]*?\[\[services\]\]\nbinding = "MAIL_RELAY"\nservice = "ccm-mail-relay"\n/,
    "\n"
  );
  writeFileSync(wranglerToml, withoutServices);
  console.warn("::warning::Deploying without MAIL_RELAY binding because ccm-mail-relay is unavailable.");
} else {
  console.log("::notice::Keeping MAIL_RELAY service binding — ccm-mail-relay is available.");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

const args = [
  "wrangler",
  "pages",
  "deploy",
  "dist",
  "--project-name=cursor-monitor-admin",
  "--branch=main",
  "--commit-dirty=true",
];

for (let attempt = 1; attempt <= 4; attempt++) {
  const result = spawnSync("npx", args, {
    cwd: adminDir,
    stdio: "inherit",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: deployToken },
  });
  if (result.status === 0) {
    process.exit(0);
  }
  if (attempt < 4) {
    const waitSec = attempt * 20;
    console.warn(`::warning::Pages deploy failed (attempt ${attempt}/4); retrying in ${waitSec}s…`);
    await sleep(waitSec * 1000);
  }
}

console.error(
  "::error::Cloudflare Pages deploy failed after retries. If logs show code 9109/10429, wait a few minutes and rerun, or refresh CLOUDFLARE_API_TOKEN in admin-production."
);
process.exit(1);
