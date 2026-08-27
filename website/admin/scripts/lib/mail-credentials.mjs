/**
 * Lorapok mail credential split (see loragent-cloudflare-mail-master skill).
 *
 * - CLOUDFLARE_API_TOKEN — Pages/Workers deploy only (wrangler)
 * - CLOUDFLARE_EMAIL_API_TOKEN — Email Sending REST only (Pages secret + probes)
 *
 * Never fall back from email token to deploy token for outbound mail.
 */

import { appendFileSync } from "node:fs";

const DEFAULT_ACCOUNT_ID = "f049faaf2f67549f5c58837479596a4a";

export function resolveMailCredentials(env = process.env) {
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID).trim();
  const deployToken = (env.CLOUDFLARE_API_TOKEN ?? "").trim();
  const emailToken = (env.CLOUDFLARE_EMAIL_API_TOKEN ?? "").trim();

  return { accountId, deployToken, emailToken };
}

export function requireDeployToken(env = process.env) {
  const { deployToken, accountId } = resolveMailCredentials(env);
  if (!deployToken) {
    throw new Error(
      'Set CLOUDFLARE_API_TOKEN (Cloudflare Pages + Workers deploy). Load via: export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"'
    );
  }
  return { deployToken, accountId };
}

export function requireEmailToken(env = process.env, { allowMissingInCi = false } = {}) {
  const { emailToken, accountId } = resolveMailCredentials(env);
  if (!emailToken) {
    if (allowMissingInCi && env.GITHUB_ACTIONS === "true") {
      return { emailToken: "", accountId };
    }
    throw new Error(
      'Set CLOUDFLARE_EMAIL_API_TOKEN (Account → Email Sending → Edit). Never use CLOUDFLARE_API_TOKEN for mail sends. Load via: export CLOUDFLARE_EMAIL_API_TOKEN="$(cred get cursor cloudflare_email_api_token)"'
    );
  }
  return { emailToken, accountId };
}

/** @param {string} name @param {string} value */
export function setGithubActionsOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(file, `${name}=${value}\n`);
}

export async function relayWorkerExists(deployToken, accountId) {
  const headers = { Authorization: `Bearer ${deployToken}` };
  const paths = [
    `accounts/${accountId}/workers/services/ccm-mail-relay`,
    `accounts/${accountId}/workers/scripts/ccm-mail-relay`,
  ];
  for (const path of paths) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/${path}`, { headers });
    if (res.status === 200) return true;
    if (res.status === 401 || res.status === 403) return false;
  }
  return false;
}

const PAGES_PROJECT = "cursor-monitor-admin";

/**
 * Probe whether a token can deploy to Cloudflare Pages / Workers.
 * Wrangler OAuth tokens often fail /user/tokens/verify but still work for Pages API.
 * @returns {Promise<{ ok: boolean; status: number; via?: string }>}
 */
export async function probeDeployToken(deployToken, accountId) {
  if (!deployToken) return { ok: false, status: 0 };

  const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${deployToken}`, "Content-Type": "application/json" },
  });
  const verifyBody = await verifyRes.json().catch(() => ({}));
  if (verifyRes.ok && verifyBody?.result?.status === "active") {
    return { ok: true, status: verifyRes.status, via: "verify" };
  }

  if (accountId) {
    const pagesRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${PAGES_PROJECT}`,
      { headers: { Authorization: `Bearer ${deployToken}` } }
    );
    if (pagesRes.ok) {
      return { ok: true, status: pagesRes.status, via: "pages" };
    }
    if (pagesRes.status === 429) {
      return { ok: false, status: pagesRes.status, via: "pages-rate-limit" };
    }

    const workersRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
      { headers: { Authorization: `Bearer ${deployToken}` } }
    );
    if (workersRes.ok) {
      return { ok: true, status: workersRes.status, via: "workers" };
    }
    if (workersRes.status === 429) {
      return { ok: false, status: workersRes.status, via: "workers-rate-limit" };
    }
  }

  return { ok: false, status: verifyRes.status || 401 };
}

/**
 * Pick the first token that passes {@link probeDeployToken}.
 * @returns {Promise<{ token: string; probe: Awaited<ReturnType<typeof probeDeployToken>> }>}
 */
export async function pickDeployToken(env = process.env) {
  const { accountId, deployToken, emailToken } = resolveMailCredentials(env);
  const candidates = [...new Set([deployToken, emailToken].filter(Boolean))];
  for (const token of candidates) {
    const probe = await probeDeployToken(token, accountId);
    if (probe.ok) return { token, probe };
  }
  return { token: deployToken, probe: await probeDeployToken(deployToken, accountId) };
}

/**
 * Probe Email Sending API with the dedicated email token.
 * @returns {Promise<{ ok: boolean; status: number; body: unknown }>}
 */
export async function probeEmailSendingToken(emailToken, accountId) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/domains`,
    { headers: { Authorization: `Bearer ${emailToken}` } }
  );
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.success !== false, status: res.status, body };
}
