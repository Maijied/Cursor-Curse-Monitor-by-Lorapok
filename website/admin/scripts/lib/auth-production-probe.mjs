/**
 * Production auth + RBAC probe helpers (SET-10).
 * Used by scripts/probe-auth-production.mjs and tests.
 */

export const DEFAULT_ADMIN_URL = "https://cursor-dev.lorapok.tech";

/**
 * @param {string} adminUrl
 * @param {typeof fetch} [fetchFn]
 */
export async function fetchStatus(adminUrl, path, fetchFn = fetch, init = {}) {
  const res = await fetchFn(`${adminUrl}${path}`, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, data, ok: res.ok };
}

/**
 * @param {{ status: number; data: unknown }} res
 */
export function isSpaHtmlFallback(res) {
  const raw = res.data?._raw;
  return typeof raw === "string" && /^\s*<!doctype html/i.test(raw);
}

export function expectStatus(res, expected) {
  return res.status === expected;
}

/**
 * @param {unknown} data
 */
export function isFirebasePublicConfig(data) {
  const config = data?.config ?? data;
  return Boolean(
    config &&
      typeof config === "object" &&
      typeof config.apiKey === "string" &&
      config.apiKey.length > 10 &&
      typeof config.authDomain === "string" &&
      typeof config.projectId === "string"
  );
}

/**
 * @param {unknown} data
 */
export function isAuthMePayload(data) {
  const user = data?.user;
  return Boolean(
    data?.ok === true &&
      user &&
      typeof user.email === "string" &&
      typeof user.role === "string" &&
      Array.isArray(user.permissions) &&
      typeof user.isMaster === "boolean"
  );
}

/** Routes that must fail closed without a Bearer token. */
export const PROTECTED_GET_ROUTES = [
  "/api/auth/me",
  "/api/auth/rbac",
  "/api/integrations/email-identities/config",
  "/api/logs?limit=1",
  "/api/mailbox?limit=1",
];

/** Mutating routes sampled for 401 without auth (no side effects on GET-only paths). */
export const PROTECTED_MUTATING_ROUTES = [
  { method: "PUT", path: "/api/auth/rbac", body: "{}" },
  { method: "POST", path: "/api/deploy", body: "{}" },
];

/**
 * @param {{
 *   adminUrl?: string;
 *   idToken?: string;
 *   invitedEmail?: string;
 *   fetchFn?: typeof fetch;
 * }} options
 */
export async function runAuthProductionProbe(options = {}) {
  const adminUrl = String(options.adminUrl ?? DEFAULT_ADMIN_URL).replace(/\/$/, "");
  const fetchFn = options.fetchFn ?? fetch;
  const idToken = String(options.idToken ?? process.env.ADMIN_ID_TOKEN ?? "").trim();
  const invitedEmail = String(options.invitedEmail ?? process.env.ADMIN_PROBE_EMAIL ?? "").trim().toLowerCase();

  const checks = [];
  const fail = (name, detail) => checks.push({ name, ok: false, detail });
  const pass = (name, detail) => checks.push({ name, ok: true, detail });

  // Login shell (SPA)
  try {
    const login = await fetchFn(`${adminUrl}/login`);
    const html = await login.text();
    if (login.status !== 200) {
      fail("login-page", `HTTP ${login.status}`);
    } else if (!/sign in|mission control|password/i.test(html)) {
      fail("login-page", "HTML missing expected login copy");
    } else {
      pass("login-page", "SPA login route reachable");
    }
  } catch (err) {
    fail("login-page", err instanceof Error ? err.message : "fetch failed");
  }

  const health = await fetchStatus(adminUrl, "/api/health", fetchFn);
  if (!expectStatus(health, 200)) {
    fail("health", `HTTP ${health.status}`);
  } else {
    pass("health", `firebaseProject=${health.data?.firebaseProject ?? "—"}`);
  }

  const firebase = await fetchStatus(adminUrl, "/api/firebase-config", fetchFn);
  if (!expectStatus(firebase, 200) || !isFirebasePublicConfig(firebase.data)) {
    fail("firebase-config", `HTTP ${firebase.status} or missing client keys`);
  } else {
    pass("firebase-config", firebase.data?.config?.projectId ?? firebase.data?.projectId);
  }

  const probeEmail = "probe-not-invited@example.com";
  const inviteUnknown = await fetchStatus(
    adminUrl,
    `/api/auth/invite-check?email=${encodeURIComponent(probeEmail)}`,
    fetchFn
  );

  const authApiDeployed =
    !isSpaHtmlFallback(inviteUnknown) &&
    expectStatus(inviteUnknown, 200) &&
    inviteUnknown.data?.invited === false;

  if (!authApiDeployed) {
    const detail = isSpaHtmlFallback(inviteUnknown)
      ? "SPA HTML fallback — deploy latest admin Functions (auth/RBAC routes)"
      : `unexpected invite-check response (HTTP ${inviteUnknown.status})`;
    fail("auth-api-deployed", detail);
  } else {
    pass("auth-api-deployed", "invite-check JSON API live");
    pass("invite-check-unknown", "invited:false for unknown email");
  }

  if (authApiDeployed) {
    const inviteMissing = await fetchStatus(adminUrl, "/api/auth/invite-check", fetchFn);
    if (!expectStatus(inviteMissing, 400)) {
      fail("invite-check-missing-email", `expected 400, got ${inviteMissing.status}`);
    } else {
      pass("invite-check-missing-email", "400 without email");
    }

    const inviteBad = await fetchStatus(
      adminUrl,
      "/api/auth/invite-check?email=not-an-email",
      fetchFn
    );
    if (!expectStatus(inviteBad, 400)) {
      fail("invite-check-invalid-email", `expected 400, got ${inviteBad.status}`);
    } else {
      pass("invite-check-invalid-email", "400 for malformed email");
    }

    if (invitedEmail) {
      const inviteKnown = await fetchStatus(
        adminUrl,
        `/api/auth/invite-check?email=${encodeURIComponent(invitedEmail)}`,
        fetchFn
      );
      if (!expectStatus(inviteKnown, 200) || inviteKnown.data?.invited !== true) {
        fail("invite-check-allowlisted", `expected invited:true for ${invitedEmail}`);
      } else {
        pass("invite-check-allowlisted", `invited:true for ${invitedEmail}`);
      }
    }

    for (const path of PROTECTED_GET_ROUTES) {
      const res = await fetchStatus(adminUrl, path, fetchFn);
      if (!expectStatus(res, 401)) {
        fail(`protected-get ${path}`, `expected 401, got ${res.status}`);
      } else {
        pass(`protected-get ${path}`, "401 without token");
      }
    }

    for (const route of PROTECTED_MUTATING_ROUTES) {
      const res = await fetchFn(`${adminUrl}${route.path}`, {
        method: route.method,
        headers: { "Content-Type": "application/json" },
        body: route.body,
      });
      const text = await res.text();
      const blocked = [401, 403, 405].includes(res.status);
      if (!blocked) {
        fail(`protected-${route.method} ${route.path}`, `expected 401/403/405, got ${res.status}: ${text.slice(0, 80)}`);
      } else {
        pass(`protected-${route.method} ${route.path}`, `${res.status} without token`);
      }
    }
  } else {
    const skip = (name) =>
      checks.push({ name, ok: true, detail: "skipped — auth API not deployed on target URL", skipped: true });
    skip("invite-check-missing-email");
    skip("invite-check-invalid-email");
    skip("invite-check-unknown");
    if (invitedEmail) skip("invite-check-allowlisted");
    for (const path of PROTECTED_GET_ROUTES) skip(`protected-get ${path}`);
    for (const route of PROTECTED_MUTATING_ROUTES) skip(`protected-${route.method} ${route.path}`);
  }

  if (idToken && authApiDeployed) {
    const me = await fetchStatus(adminUrl, "/api/auth/me", fetchFn, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!expectStatus(me, 200) || !isAuthMePayload(me.data)) {
      fail("auth-me-token", `HTTP ${me.status} or invalid payload`);
    } else {
      const { role, permissions, isMaster } = me.data.user;
      pass("auth-me-token", `role=${role}, perms=${permissions.length}, master=${isMaster}`);

      const rbac = await fetchStatus(adminUrl, "/api/auth/rbac", fetchFn, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const expectsRbac = isMaster || permissions.includes("team.manage");
      if (expectsRbac) {
        if (!expectStatus(rbac, 200) || !Array.isArray(rbac.data?.members)) {
          fail("auth-rbac-master", `expected 200 team snapshot, got ${rbac.status}`);
        } else {
          pass("auth-rbac-master", `${rbac.data.members.length} members`);
        }
      } else if (!expectStatus(rbac, 403)) {
        fail("auth-rbac-denied", `non-master expected 403, got ${rbac.status}`);
      } else {
        pass("auth-rbac-denied", "403 for role without team.manage");
      }

      const identities = await fetchStatus(adminUrl, "/api/integrations/email-identities/config", fetchFn, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const canReadIdentities =
        isMaster || permissions.includes("settings.read") || permissions.includes("*");
      if (canReadIdentities) {
        if (!expectStatus(identities, 200)) {
          fail("email-identities-read", `expected 200, got ${identities.status}`);
        } else {
          pass("email-identities-read", "settings.read path OK");
        }
      } else if (!expectStatus(identities, 403)) {
        fail("email-identities-denied", `expected 403, got ${identities.status}`);
      } else {
        pass("email-identities-denied", "403 without settings.read");
      }
    }
  } else {
    checks.push({
      name: "auth-me-token",
      ok: true,
      detail: "skipped — set ADMIN_ID_TOKEN after password login for authenticated tier",
      skipped: true,
    });
  }

  const failed = checks.filter((c) => c.ok === false);
  return {
    ok: failed.length === 0,
    adminUrl,
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((c) => c.ok && !c.skipped).length,
      failed: failed.length,
      skipped: checks.filter((c) => c.skipped).length,
    },
  };
}
