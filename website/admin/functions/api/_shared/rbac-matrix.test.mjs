import assert from "node:assert/strict";
import { requirePermission } from "./auth.js";
import {
  PERMISSIONS,
  assignAdminRole,
  buildAdminAuthContext,
  permissionsForRole,
  roleHasPermission,
} from "./rbac.js";
import { MUTATING_ROUTE_PERMISSIONS, READ_ROUTE_PERMISSIONS } from "./rbac-routes.js";

/** Canonical AUTH-01 matrix (non-master roles). */
const ROLE_MATRIX = {
  admin: [
    "settings.read",
    "integrations.read",
    "mail.read",
    "mail.send",
    "deploy.run",
    "notices.write",
    "subscribers.write",
    "logs.read",
    "profile.write",
  ],
  operator: ["mail.read", "mail.send", "notices.write", "subscribers.write", "logs.read", "profile.write"],
  viewer: ["settings.read", "integrations.read", "mail.read", "logs.read", "profile.write"],
};

for (const permission of PERMISSIONS) {
  assert.equal(roleHasPermission(permissionsForRole("master"), permission), true, `master → ${permission}`);
}

for (const [role, allowed] of Object.entries(ROLE_MATRIX)) {
  const granted = permissionsForRole(role);
  for (const permission of allowed) {
    assert.equal(roleHasPermission(granted, permission), true, `${role} should have ${permission}`);
  }
  for (const permission of PERMISSIONS) {
    if (!allowed.includes(permission)) {
      assert.equal(roleHasPermission(granted, permission), false, `${role} should NOT have ${permission}`);
    }
  }
}

/**
 * @param {"master"|"admin"|"operator"|"viewer"} role
 */
function mockAuth(role) {
  const isMaster = role === "master";
  const permissions = [...permissionsForRole(role)];
  return {
    role,
    isMaster,
    permissions,
    hasPermission(permission) {
      if (isMaster) return true;
      return roleHasPermission(permissions, permission);
    },
  };
}

function assertDenied(role, permission) {
  const res = requirePermission(mockAuth(role), permission);
  assert.ok(res instanceof Response, `${role} should be denied ${permission}`);
  assert.equal(res.status, 403);
}

function assertAllowed(role, permission) {
  const res = requirePermission(mockAuth(role), permission);
  assert.equal(res, null, `${role} should be allowed ${permission}`);
}

const MASTER_ONLY = [
  "deploy.infra",
  "settings.write",
  "team.manage",
  "mail.provision",
  "integrations.write",
  "secrets.manage",
];

for (const role of ["admin", "operator", "viewer"]) {
  for (const permission of MASTER_ONLY) {
    assertDenied(role, permission);
  }
}

assertDenied("viewer", "mail.send");
assertDenied("viewer", "notices.write");
assertDenied("viewer", "subscribers.write");

assertAllowed("admin", "mail.send");
assertAllowed("admin", "notices.write");
assertAllowed("admin", "deploy.run");
assertDenied("admin", "deploy.infra");

assertAllowed("operator", "mail.send");
assertDenied("operator", "settings.read");

assertAllowed("viewer", "logs.read");
assertAllowed("viewer", "settings.read");

for (const [, permission] of Object.entries(MUTATING_ROUTE_PERMISSIONS)) {
  if (permission === "profile.write") {
    assertAllowed("viewer", permission);
    continue;
  }
  assertDenied("viewer", permission);
}

for (const [, permission] of Object.entries(READ_ROUTE_PERMISSIONS)) {
  for (const role of ["viewer", "operator"]) {
    if (ROLE_MATRIX[role].includes(permission)) {
      assertAllowed(role, permission);
    } else {
      assertDenied(role, permission);
    }
  }
  assertAllowed("admin", permission);
}

const kvStore = new Map();
const kvEnv = {
  ADMIN_KV: {
    get: async (key) => kvStore.get(key) ?? null,
    put: async (key, value) => kvStore.set(key, value),
  },
  ADMIN_EMAILS: "viewer@lorapok.tech",
};

await assignAdminRole(kvEnv, "viewer@lorapok.tech", "viewer");
const ctx = await buildAdminAuthContext(kvEnv, "viewer@lorapok.tech", false);
assert.equal(ctx.role, "viewer");
assert.ok(requirePermission(ctx, "deploy.run") instanceof Response);
assert.equal(requirePermission(ctx, "profile.write"), null);

console.log("rbac-matrix.test.mjs: OK");
