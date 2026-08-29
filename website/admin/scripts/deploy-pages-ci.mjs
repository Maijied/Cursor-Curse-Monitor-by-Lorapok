#!/usr/bin/env node
/**
 * CI-only Cloudflare Pages deploy with MAIL_RELAY binding guard and auth retries.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pickDeployToken, probeDeployToken, resolveMailCredentials, tryWranglerOAuthToken } from "./lib/mail-credentials.mjs";
import {
  classifyWranglerFailure,
  resolvePagesPreDeployCooldownSec,
  resolveRetryWaitSec,
  shouldStopPagesDeployRetries,
} from "./lib/deploy-retry.mjs";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const inCi = process.env.GITHUB_ACTIONS === "true";
const skipMailSetup = process.env.SKIP_MAIL_SETUP === "true";
const { accountId, deployToken: envDeployToken } = resolveMailCredentials();
const relayDeployed = process.env.MAIL_RELAY_DEPLOYED === "true";
const relayExists =
  process.env.MAIL_RELAY_EXISTS_SETUP === "true" ||
  process.env.MAIL_RELAY_EXISTS_VERIFY === "true";

if (!accountId) {
  console.error("::error::CLOUDFLARE_ACCOUNT_ID is required.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function pickDeployTokenWithRetry(maxAttempts = 4) {
  let sawRateLimit = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await pickDeployToken();
    if (result.probe.ok) {
      return { ...result, sawRateLimit };
    }
    if (result.probe.via?.includes("rate-limit")) {
      sawRateLimit = true;
      if (attempt < maxAttempts) {
        const waitSec = attempt * 15;
        console.warn(
          `::warning::Deploy token probe rate-limited (HTTP ${result.probe.status}); retrying in ${waitSec}s (${attempt}/${maxAttempts})…`
        );
        await sleep(waitSec * 1000);
        continue;
      }
    }
    return { ...result, sawRateLimit };
  }
  const fallback = await pickDeployToken();
  return { ...fallback, sawRateLimit };
}

async function resolveDeployAuth() {
  if (!envDeployToken) {
    return {
      token: null,
      probe: { ok: false, status: 0 },
      sawRateLimit: false,
    };
  }

  if (inCi && skipMailSetup) {
    const probe = await probeDeployToken(envDeployToken, accountId);
    if (probe.ok) {
      console.log(
        `::notice::CI push: deploy token verified (${probe.via ?? "probe"}${probe.status ? ` HTTP ${probe.status}` : ""}).`
      );
      return { token: envDeployToken, probe, sawRateLimit: false };
    }
    if (probe.via?.includes("rate-limit")) {
      console.warn(
        `::warning::CI push: deploy token probe rate-limited (HTTP ${probe.status}); attempting Pages deploy once.`
      );
      return { token: envDeployToken, probe, sawRateLimit: true };
    }
    console.error(
      "::error::CLOUDFLARE_API_TOKEN cannot deploy to Cloudflare Pages " +
        `(HTTP ${probe.status}). Refresh the admin-production secret with a token that has ` +
        "Account → Cloudflare Pages → Edit (and Workers Scripts → Edit for the mail relay). " +
        'Local: export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)" then ' +
        "gh secret set CLOUDFLARE_API_TOKEN --env admin-production"
    );
    process.exit(1);
  }

  if (inCi) {
    const reason = "mail setup already exercised Cloudflare APIs";
    console.log(`::notice::CI: using CLOUDFLARE_API_TOKEN without pre-deploy probe (${reason}).`);
    return {
      token: envDeployToken,
      probe: { ok: true, status: 0, via: "ci-skip-probe" },
      sawRateLimit: false,
    };
  }

  const picked = await pickDeployTokenWithRetry();
  if (picked.probe.ok) {
    return picked;
  }

  const oauth = tryWranglerOAuthToken(adminDir);
  if (oauth) {
    const oauthProbe = await probeDeployToken(oauth, accountId);
    if (oauthProbe.ok) {
      console.warn(
        `Using wrangler OAuth token (stored deploy token invalid or expired: HTTP ${picked.probe.status}).`
      );
      console.warn(
        "  Tip: refresh vault token with: node website/admin/scripts/sync-mail-cred-vault.mjs"
      );
      return { token: oauth, probe: oauthProbe, sawRateLimit: false };
    }
  }

  return picked;
}

function runWranglerDeploy(args, token) {
  const result = spawnSync("npx", args, {
    cwd: adminDir,
    encoding: "utf8",
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { status: result.status ?? 1, output };
}

const { token: deployToken, probe, sawRateLimit } = await resolveDeployAuth();
if (!deployToken) {
  console.error("::error::CLOUDFLARE_API_TOKEN (or CLOUDFLARE_EMAIL_API_TOKEN) is required.");
  process.exit(1);
}

if (probe.ok) {
  console.log(`::notice::Using deploy token (${probe.via ?? "probe"}${probe.status ? ` HTTP ${probe.status}` : ""}).`);
} else if (sawRateLimit || probe.via?.includes("rate-limit")) {
  console.warn(
    `::warning::Deploy token probe still rate-limited after retries (HTTP ${probe.status}); attempting wrangler Pages deploy anyway.`
  );
} else if (deployToken) {
  console.warn(
    `::warning::Deploy token probe failed (HTTP ${probe.status}); attempting wrangler Pages deploy anyway — wrangler may still succeed when Cloudflare verify/Pages probes are flaky.`
  );
} else {
  console.error(
    `::error::No deploy token available (HTTP ${probe.status}). ` +
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

if (inCi) {
  const mailLightweight = process.env.MAIL_API_LIGHTWEIGHT === "true" || skipMailSetup;
  const preCooldownSec = resolvePagesPreDeployCooldownSec({
    inCi: true,
    skipMailSetup,
    mailLightweight,
    env: process.env,
  });
  if (preCooldownSec > 0) {
    console.log(
      `::notice::CI: waiting ${preCooldownSec}s before Pages deploy so Cloudflare rate limits can clear…`
    );
    await sleep(preCooldownSec * 1000);
  }
}

const args = [
  "wrangler",
  "pages",
  "deploy",
  "dist",
  "--project-name=cursor-monitor-admin",
  `--branch=${process.env.CF_PAGES_BRANCH ?? "main"}`,
  "--commit-dirty=true",
];

const maxAttempts = Number(
  process.env.CF_DEPLOY_MAX_ATTEMPTS ?? (skipMailSetup ? 1 : 4)
);
let lastFailureKind = "other";
let sawDeployRateLimit = false;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const result = runWranglerDeploy(args, deployToken);
  if (result.status === 0) {
    process.exit(0);
  }

  lastFailureKind = classifyWranglerFailure(result.output);
  if (lastFailureKind === "rate-limit") {
    sawDeployRateLimit = true;
  }

  if (attempt >= maxAttempts) {
    break;
  }

  const stop = shouldStopPagesDeployRetries({
    sawRateLimit: sawDeployRateLimit,
    failureKind: lastFailureKind,
    attempt,
    maxAttempts,
  });
  if (stop.stop) {
    if (stop.reason === "auth-lockout-after-rate-limit") {
      console.error(
        "::error::Cloudflare token appears locked after rate limiting — stopping retries in this job. " +
          "Wait 5+ minutes, then rerun deploy-infra."
      );
    } else if (stop.reason === "invalid-token") {
      console.error(
        "::error::Cloudflare deploy token rejected (9109/10000) — not retrying. " +
          "Refresh CLOUDFLARE_API_TOKEN in admin-production, then rerun deploy-infra."
      );
    }
    break;
  }

  const waitSec = resolveRetryWaitSec(lastFailureKind, attempt, result.output);
  console.warn(
    `::warning::Pages deploy failed (${lastFailureKind}, attempt ${attempt}/${maxAttempts}); retrying in ${waitSec}s…`
  );
  await sleep(waitSec * 1000);
}

console.error(
  "::error::Cloudflare Pages deploy failed after retries. " +
    `Last failure: ${lastFailureKind}. ` +
    "If logs show code 9109/10429, wait a few minutes and rerun workflow_dispatch deploy-infra, " +
    "or refresh CLOUDFLARE_API_TOKEN in admin-production."
);
process.exit(1);
