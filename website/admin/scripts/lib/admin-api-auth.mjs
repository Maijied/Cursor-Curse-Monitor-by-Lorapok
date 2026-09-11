/**
 * Resolve a Firebase ID token for Mission Control API calls (CLI / smoke scripts).
 */
import { SignJWT, importPKCS8 } from "jose";
import { decryptCredentialVault } from "./cred-vault-sync.mjs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const IDENTITY_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";

/**
 * @param {string} adminUrl
 */
async function fetchPublicFirebaseApiKey(adminUrl) {
  const base = adminUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/firebase-config`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.config?.apiKey) {
    throw new Error(data.error || `Firebase config unavailable (${res.status})`);
  }
  return String(data.config.apiKey);
}

/**
 * @param {{ apiKey: string; email: string; password: string }} input
 */
export async function signInWithFirebasePassword(input) {
  const email = String(input.email ?? "").trim();
  const password = String(input.password ?? "");
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for password sign-in");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Firebase sign-in failed (${res.status})`);
  }
  const idToken = String(data.idToken ?? "").trim();
  if (!idToken) throw new Error("Firebase sign-in returned no idToken");
  return idToken;
}

/**
 * @param {Record<string, unknown>} serviceAccount
 * @param {string} scope
 */
async function getGoogleAccessToken(serviceAccount, scope) {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(String(serviceAccount.private_key).replace(/\\n/g, "\n"), "RS256");
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(String(serviceAccount.client_email))
    .setSubject(String(serviceAccount.client_email))
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Google OAuth failed (${res.status})`);
  }
  return String(data.access_token);
}

/**
 * @param {Record<string, unknown>} serviceAccount
 * @param {string} email
 */
async function lookupFirebaseUid(serviceAccount, email) {
  const projectId = String(serviceAccount.project_id ?? "").trim();
  const accessToken = await getGoogleAccessToken(serviceAccount, IDENTITY_SCOPE);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: [email] }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Firebase account lookup failed (${res.status})`);
  }
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error(`No Firebase Auth user for ${email}`);
  return String(uid);
}

/**
 * @param {Record<string, unknown>} serviceAccount
 * @param {string} uid
 * @param {string} email
 */
async function createFirebaseCustomToken(serviceAccount, uid, email) {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(String(serviceAccount.private_key).replace(/\\n/g, "\n"), "RS256");
  return new SignJWT({
    uid,
    claims: { email, email_verified: true },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(String(serviceAccount.client_email))
    .setSubject(String(serviceAccount.client_email))
    .setAudience(
      "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit"
    )
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}

/**
 * @param {string} apiKey
 * @param {string} customToken
 */
async function exchangeCustomTokenForIdToken(apiKey, customToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Custom token exchange failed (${res.status})`);
  }
  const idToken = String(data.idToken ?? "").trim();
  if (!idToken) throw new Error("Custom token exchange returned no idToken");
  return idToken;
}

/**
 * Mint ADMIN_ID_TOKEN via cred vault service account + master admin email.
 * @param {string} adminUrl
 */
export async function signInWithCredVaultServiceAccount(adminUrl) {
  const vault = decryptCredentialVault();
  const cursor = vault?.cursor ?? vault ?? {};
  const rawSa = cursor.firebase_service_account_json;
  const email = String(cursor.admin_master_email ?? process.env.ADMIN_MASTER_EMAIL ?? "").trim().toLowerCase();
  if (!rawSa || !email) {
    throw new Error("Cred vault missing firebase_service_account_json or admin_master_email");
  }
  const serviceAccount =
    typeof rawSa === "string" ? JSON.parse(rawSa) : rawSa;
  const apiKey = await fetchPublicFirebaseApiKey(adminUrl);
  const uid = await lookupFirebaseUid(serviceAccount, email);
  const customToken = await createFirebaseCustomToken(serviceAccount, uid, email);
  const idToken = await exchangeCustomTokenForIdToken(apiKey, customToken);
  return { adminUrl: adminUrl.replace(/\/$/, ""), idToken, email };
}

/**
 * @param {{ adminUrl?: string; idToken?: string; email?: string; password?: string }} [options]
 */
export async function resolveAdminIdToken(options = {}) {
  const adminUrl = String(options.adminUrl ?? process.env.ADMIN_PUBLIC_URL ?? "https://cursor-dev.lorapok.tech").replace(
    /\/$/,
    ""
  );
  const idToken = String(options.idToken ?? process.env.ADMIN_ID_TOKEN ?? "").trim();
  if (idToken) return { adminUrl, idToken };

  const email = String(options.email ?? process.env.ADMIN_EMAIL ?? "").trim();
  const password = String(options.password ?? process.env.ADMIN_PASSWORD ?? "");
  if (email && password) {
    const apiKey = await fetchPublicFirebaseApiKey(adminUrl);
    const signedIn = await signInWithFirebasePassword({ apiKey, email, password });
    return { adminUrl, idToken: signedIn };
  }

  if (process.env.CCM_SKIP_CRED_VAULT !== "1") {
    try {
      return await signInWithCredVaultServiceAccount(adminUrl);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Missing admin auth. Set ADMIN_ID_TOKEN, ADMIN_EMAIL+ADMIN_PASSWORD, or fix cred vault sign-in: ${detail}`
      );
    }
  }

  throw new Error(
    "Missing admin auth. Set ADMIN_ID_TOKEN, or ADMIN_EMAIL + ADMIN_PASSWORD (Mission Control login)."
  );
}
