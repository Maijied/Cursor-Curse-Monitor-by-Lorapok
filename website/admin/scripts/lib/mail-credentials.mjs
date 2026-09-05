/**
 * Lorapok mail credential split (see loragent-cloudflare-mail-master skill).
 *
 * - CLOUDFLARE_API_TOKEN — Pages/Workers deploy only (wrangler)
 * - CLOUDFLARE_EMAIL_API_TOKEN — Email Sending REST only (Pages secret + probes)
 *
 * Never fall back from email token to deploy token for outbound mail.
 */

import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { envWithCursorCloudflareSecrets } from "./cred-vault-sync.mjs";

const DEFAULT_ACCOUNT_ID = "f049faaf2f67549f5c58837479596a4a";

export function resolveMailCredentials(env = process.env) {
  const mergedEnv = envWithCursorCloudflareSecrets(env);
  const accountId = (mergedEnv.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID).trim();
  const deployToken = (mergedEnv.CLOUDFLARE_API_TOKEN ?? "").trim();
  const emailToken = (mergedEnv.CLOUDFLARE_EMAIL_API_TOKEN ?? "").trim();
  const globalApiKey = (mergedEnv.CLOUDFLARE_API_KEY ?? "").trim();
  const globalApiEmail = (mergedEnv.CLOUDFLARE_EMAIL ?? "").trim();

  return { accountId, deployToken, emailToken, globalApiKey, globalApiEmail };
}

/**
 * Build Cloudflare API auth headers for bearer token or Global API Key.
 * @param {{ bearerToken?: string; globalApiKey?: string; globalApiEmail?: string }} opts
 */
export function cloudflareAuthHeaders({ bearerToken, globalApiKey, globalApiEmail } = {}) {
  if (bearerToken) {
    return { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" };
  }
  if (globalApiKey && globalApiEmail) {
    return {
      "X-Auth-Key": globalApiKey,
      "X-Auth-Email": globalApiEmail,
      "Content-Type": "application/json",
    };
  }
  return { "Content-Type": "application/json" };
}

/**
 * Wrangler env for deploy — bearer token OR global API key + email.
 * @param {string} accountId
 * @param {{ type: "bearer"; token: string } | { type: "global"; apiKey: string; email: string }} auth
 * @param {NodeJS.ProcessEnv} [baseEnv]
 */
export function wranglerDeployEnv(accountId, auth, baseEnv = process.env) {
  const env = { ...baseEnv, CLOUDFLARE_ACCOUNT_ID: accountId };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_API_KEY;
  delete env.CLOUDFLARE_EMAIL;
  if (auth.type === "bearer") {
    env.CLOUDFLARE_API_TOKEN = auth.token;
  } else {
    env.CLOUDFLARE_API_KEY = auth.apiKey;
    env.CLOUDFLARE_EMAIL = auth.email;
  }
  return env;
}

export function requireDeployToken(env = process.env) {
  const { deployToken, accountId, globalApiKey, globalApiEmail } = resolveMailCredentials(env);
  if (deployToken) {
    return { deployToken, accountId, globalApiKey, globalApiEmail };
  }
  if (globalApiKey && globalApiEmail) {
    return { deployToken: "", accountId, globalApiKey, globalApiEmail };
  }
  throw new Error(
    "CLOUDFLARE_API_TOKEN or CLOUDFLARE_API_KEY+CLOUDFLARE_EMAIL missing. Local options:\n" +
      "  • .cred-vault-passphrase at repo root (repair-mail loads gpg vault)\n" +
      "  • cd website/admin && npx wrangler login  (repair-mail falls back to wrangler OAuth)\n" +
      '  • export CLOUDFLARE_API_TOKEN="$(cred get cursor cloudflare_api_token)"\n' +
      "  • cred vault: cloudfare/cloudfare_global_api_key + cursor/cloudflare_account_email"
  );
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

export async function relayWorkerExists(deployToken, accountId, globalAuth) {
  const headers = globalAuth
    ? cloudflareAuthHeaders(globalAuth)
    : cloudflareAuthHeaders({ bearerToken: deployToken });
  const paths = [
    `accounts/${accountId}/workers/services/ccm-mail-relay`,
    `accounts/${accountId}/workers/scripts/ccm-mail-relay`,
  ];
  for (const path of paths) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/${path}`, { headers });
    if (res.status === 200) return true;
    if (res.status === 429) return "rate-limited";
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
 * Probe Global API Key auth (X-Auth-Email + X-Auth-Key) for Pages/Workers deploy.
 * @returns {Promise<{ ok: boolean; status: number; via?: string }>}
 */
export async function probeDeployGlobalKey(globalApiKey, globalApiEmail, accountId) {
  if (!globalApiKey || !globalApiEmail) return { ok: false, status: 0 };

  const headers = cloudflareAuthHeaders({ globalApiKey, globalApiEmail });
  const userRes = await fetch("https://api.cloudflare.com/client/v4/user", { headers });
  if (!userRes.ok) {
    if (userRes.status === 429) return { ok: false, status: userRes.status, via: "user-rate-limit" };
    return { ok: false, status: userRes.status, via: "user" };
  }

  if (accountId) {
    const pagesRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${PAGES_PROJECT}`,
      { headers }
    );
    if (pagesRes.ok) {
      return { ok: true, status: pagesRes.status, via: "pages-global-key" };
    }
    if (pagesRes.status === 429) {
      return { ok: false, status: pagesRes.status, via: "pages-rate-limit" };
    }

    const workersRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
      { headers }
    );
    if (workersRes.ok) {
      return { ok: true, status: workersRes.status, via: "workers-global-key" };
    }
    if (workersRes.status === 429) {
      return { ok: false, status: workersRes.status, via: "workers-rate-limit" };
    }
  }

  return { ok: true, status: userRes.status, via: "user-global-key" };
}

/** @param {string} cwd Admin directory with wrangler in node_modules */
export function tryWranglerOAuthToken(cwd) {
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_EMAIL_API_TOKEN;
  const r = spawnSync("npx", ["wrangler", "auth", "token", "--json"], {
    encoding: "utf8",
    cwd,
    env,
  });
  const text = `${r.stdout}\n${r.stderr}`;
  const match = text.match(/\{[\s\S]*"token"[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]).token ?? null;
  } catch {
    return null;
  }
}

/**
 * Pick the first token that passes {@link probeDeployToken}.
 * @returns {Promise<{ token: string; probe: Awaited<ReturnType<typeof probeDeployToken>> }>}
 */
export async function pickDeployToken(env = process.env) {
  const picked = await pickDeployAuth(env);
  if (picked.auth.type === "bearer") {
    return { token: picked.auth.token, probe: picked.probe };
  }
  return { token: "", probe: picked.probe };
}

/**
 * Pick bearer token or Global API Key for Cloudflare deploy.
 * @returns {Promise<{ auth: { type: "bearer"; token: string } | { type: "global"; apiKey: string; email: string }; probe: Awaited<ReturnType<typeof probeDeployToken>> }>}
 */
export async function pickDeployAuth(env = process.env) {
  const { accountId, deployToken, emailToken, globalApiKey, globalApiEmail } = resolveMailCredentials(env);
  const candidates = [...new Set([deployToken, emailToken].filter(Boolean))];
  for (const token of candidates) {
    const probe = await probeDeployToken(token, accountId);
    if (probe.ok) return { auth: { type: "bearer", token }, probe };
  }

  if (globalApiKey && globalApiEmail) {
    const probe = await probeDeployGlobalKey(globalApiKey, globalApiEmail, accountId);
    if (probe.ok) {
      return { auth: { type: "global", apiKey: globalApiKey, email: globalApiEmail }, probe };
    }
  }

  const fallbackProbe = deployToken
    ? await probeDeployToken(deployToken, accountId)
    : globalApiKey && globalApiEmail
      ? await probeDeployGlobalKey(globalApiKey, globalApiEmail, accountId)
      : { ok: false, status: 0 };

  if (globalApiKey && globalApiEmail) {
    return {
      auth: { type: "global", apiKey: globalApiKey, email: globalApiEmail },
      probe: fallbackProbe,
    };
  }
  return { auth: { type: "bearer", token: deployToken }, probe: fallbackProbe };
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

/**
 * Resolve master admin email from env (vault-loaded in CI).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveAdminMasterEmailFromEnv(env = process.env) {
  const merged = envWithCursorCloudflareSecrets(env);
  const email = String(
    merged.ADMIN_MASTER_EMAIL ?? merged.VITE_ADMIN_MASTER_EMAIL ?? ""
  )
    .trim()
    .toLowerCase();
  return email.includes("@") ? email : "";
}

/**
 * Set a Cloudflare Pages encrypted secret (Functions runtime).
 * @param {string} name
 * @param {string} value
 * @param {{ adminDir: string; accountId: string; auth: { type: "bearer"; token: string } | { type: "global"; apiKey: string; email: string }; baseEnv?: NodeJS.ProcessEnv }} opts
 */
export function putPagesSecret(name, value, { adminDir, accountId, auth, baseEnv = process.env }) {
  const wranglerEnv = wranglerDeployEnv(accountId, auth, baseEnv);
  const result = spawnSync(
    "npx",
    ["wrangler", "pages", "secret", "put", name, "--project-name", PAGES_PROJECT],
    {
      cwd: adminDir,
      input: value,
      encoding: "utf8",
      env: wranglerEnv,
    }
  );
  if (result.status !== 0) {
    const detail = (result.stderr ?? result.stdout ?? "").trim();
    throw new Error(`Pages secret put ${name} failed${detail ? `: ${detail}` : ""}`);
  }
}
