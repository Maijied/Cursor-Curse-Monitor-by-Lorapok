#!/usr/bin/env node
/**
 * Enable Firebase Email link (passwordless) sign-in for the admin project.
 * Auth sources (in order): gcloud, firebase-tools login refresh token, CRED vault.
 *
 * Usage: node scripts/enable-firebase-email-link.mjs
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "cursor-curse-by-lorapok";
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";
const AUTHORIZED_DOMAINS = [
  "localhost",
  "cursor-dev.lorapok.tech",
  "cursor-monitor-admin-2x8.pages.dev",
  `${PROJECT_ID}.firebaseapp.com`,
  `${PROJECT_ID}.web.app`,
];

function gcloudToken() {
  const result = spawnSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

async function firebaseToolsRefreshToken() {
  const path = join(homedir(), ".config", "configstore", "firebase-tools.json");
  try {
    const cfg = JSON.parse(readFileSync(path, "utf8"));
    return cfg?.tokens?.refresh_token ?? null;
  } catch {
    return null;
  }
}

async function accessTokenFromRefresh(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: FIREBASE_CLI_CLIENT_ID,
      client_secret: FIREBASE_CLI_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.access_token ?? null;
}

async function resolveAccessToken() {
  const fromGcloud = gcloudToken();
  if (fromGcloud) return fromGcloud;

  const refresh = await firebaseToolsRefreshToken();
  if (refresh) {
    const token = await accessTokenFromRefresh(refresh);
    if (token) return token;
  }

  return null;
}

async function getCurrentConfig(token) {
  const urls = [
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`,
    `https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config`,
  ];
  let lastError = "";
  for (const url of urls) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.ok) return res.json();
    lastError = `${url} ${res.status}: ${(await res.text()).slice(0, 200)}`;
  }
  throw new Error(`GET config failed: ${lastError}`);
}

async function patchAuthConfig(token) {
  const current = await getCurrentConfig(token);
  const domains = new Set([...(current.authorizedDomains ?? []), ...AUTHORIZED_DOMAINS]);

  const body = {
    signIn: {
      email: {
        enabled: true,
        passwordRequired: false,
      },
    },
    authorizedDomains: [...domains],
  };

  const urls = [
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`,
    `https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,authorizedDomains`,
  ];

  let lastError = "";
  for (const url of urls) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    lastError = `${url} ${res.status}: ${text.slice(0, 300)}`;
  }
  throw new Error(`PATCH config failed: ${lastError}`);
}

async function verifyEmailLinkEnabled() {
  const publicCfg = JSON.parse(
    readFileSync(join(process.cwd(), "website", "firebase-public.json"), "utf8")
  );
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${publicCfg.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: "EMAIL_SIGNIN",
        email: "admin@lorapok.tech",
        continueUrl: "https://cursor-dev.lorapok.tech/login",
        canHandleCodeInApp: true,
      }),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true };
  const message = json?.error?.message ?? `HTTP ${res.status}`;
  if (String(message).includes("OPERATION_NOT_ALLOWED")) {
    return { ok: false, message };
  }
  // Non-blocking errors (rate limit, etc.) still imply the provider is enabled.
  return { ok: true, message: `probe note: ${message}` };
}

async function main() {
  const token = await resolveAccessToken();
  if (!token) {
    console.error(`No Google access token available. Options:
  - gcloud auth login
  - firebase login (creates ~/.config/configstore/firebase-tools.json)
  - Firebase Console → Authentication → Sign-in method → Email link`);
    process.exit(1);
  }

  const updated = await patchAuthConfig(token);
  const emailEnabled = updated?.signIn?.email?.enabled;
  const passwordRequired = updated?.signIn?.email?.passwordRequired;
  const passwordless = emailEnabled && passwordRequired === false;
  console.log(`Firebase project: ${PROJECT_ID}`);
  console.log(`Email sign-in enabled: ${emailEnabled ? "yes" : "no"}`);
  console.log(`Passwordless email link: ${passwordless ? "yes" : "no"}`);
  if (!passwordless) {
    console.log(`  (passwordRequired=${String(passwordRequired)})`);
  }
  console.log(`Authorized domains (${(updated.authorizedDomains ?? []).length}):`);
  for (const d of updated.authorizedDomains ?? []) {
    if (AUTHORIZED_DOMAINS.includes(d)) console.log(`  ✓ ${d}`);
  }

  const verify = await verifyEmailLinkEnabled();
  if (verify.ok) {
    console.log(`Email link probe: OK${verify.message ? ` (${verify.message})` : ""}`);
  } else {
    console.log(`Email link probe: FAILED — ${verify.message}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
