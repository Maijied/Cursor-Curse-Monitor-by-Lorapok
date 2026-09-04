import assert from "node:assert/strict";
import {
  isAuthMePayload,
  isFirebasePublicConfig,
  runAuthProductionProbe,
} from "./auth-production-probe.mjs";

assert.equal(isFirebasePublicConfig({ config: { apiKey: "AIzaSy1234567890", authDomain: "x.firebaseapp.com", projectId: "x" } }), true);
assert.equal(isFirebasePublicConfig({ config: { apiKey: "short" } }), false);

assert.equal(
  isAuthMePayload({
    ok: true,
    user: { email: "a@b.com", role: "admin", permissions: ["mail.read"], isMaster: false },
  }),
  true
);
assert.equal(isAuthMePayload({ ok: true, user: { email: "a@b.com" } }), false);

const mockFetch = async (url, init = {}) => {
  const u = String(url);
  const auth = init.headers?.Authorization ?? init.headers?.authorization;

  if (u.endsWith("/login")) {
    return { status: 200, text: async () => "<html>Mission Control — Sign in with password</html>" };
  }
  if (u.endsWith("/api/health")) {
    return { status: 200, text: async () => JSON.stringify({ firebaseProject: "test" }) };
  }
  if (u.endsWith("/api/firebase-config")) {
    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          config: { apiKey: "AIzaSy1234567890", authDomain: "t.firebaseapp.com", projectId: "t" },
        }),
    };
  }
  if (u.includes("/api/auth/invite-check") && !u.includes("email=")) {
    return { status: 400, text: async () => JSON.stringify({ error: "email required" }) };
  }
  if (u.includes("not-an-email")) {
    return { status: 400, text: async () => JSON.stringify({ error: "invalid" }) };
  }
  if (u.includes("probe-not-invited")) {
    return { status: 200, text: async () => JSON.stringify({ invited: false }) };
  }
  if (decodeURIComponent(u).includes("invited@lorapok.tech")) {
    return { status: 200, text: async () => JSON.stringify({ invited: true }) };
  }
  if (!auth && (u.includes("/api/auth/me") || u.includes("/api/auth/rbac") || u.includes("/api/logs") || u.includes("/api/mailbox"))) {
    return { status: 401, text: async () => JSON.stringify({ error: "Missing or invalid Authorization header" }) };
  }
  if (!auth && u.includes("/api/integrations/email-identities/config")) {
    return { status: 401, text: async () => JSON.stringify({ error: "Missing or invalid Authorization header" }) };
  }
  if (!auth && init.method === "PUT" && u.includes("/api/auth/rbac")) {
    return { status: 401, text: async () => JSON.stringify({ error: "Missing or invalid Authorization header" }) };
  }
  if (!auth && init.method === "POST" && u.includes("/api/deploy")) {
    return { status: 401, text: async () => JSON.stringify({ error: "Missing or invalid Authorization header" }) };
  }
  if (auth && u.endsWith("/api/auth/me")) {
    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          user: {
            email: "viewer@lorapok.tech",
            role: "viewer",
            permissions: ["settings.read", "mail.read", "logs.read", "profile.write"],
            isMaster: false,
          },
        }),
    };
  }
  if (auth && u.endsWith("/api/auth/rbac")) {
    return { status: 403, text: async () => JSON.stringify({ error: "Forbidden" }) };
  }
  if (auth && u.includes("/api/integrations/email-identities/config")) {
    return { status: 200, text: async () => JSON.stringify({ ok: true, config: { identities: [] } }) };
  }
  if (auth && u.includes("/api/mailbox")) {
    return { status: 200, text: async () => JSON.stringify({ ok: true, messages: [] }) };
  }
  return { status: 404, text: async () => "{}" };
};

const base = await runAuthProductionProbe({
  adminUrl: "https://example.test",
  invitedEmail: "invited@lorapok.tech",
  fetchFn: mockFetch,
});

assert.equal(base.ok, true);
assert.ok(base.checks.some((c) => c.name === "invite-check-allowlisted" && c.ok));

const authed = await runAuthProductionProbe({
  adminUrl: "https://example.test",
  idToken: "fake-token",
  fetchFn: mockFetch,
});

assert.equal(authed.ok, true);
assert.ok(authed.checks.some((c) => c.name === "auth-rbac-denied" && c.ok));

console.log("auth-production-probe.test.mjs: OK");
