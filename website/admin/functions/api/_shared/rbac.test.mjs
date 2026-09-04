import assert from "node:assert/strict";
import {
  permissionsForRole,
  roleHasPermission,
  resolveAdminRole,
  assignAdminRole,
  removeAdminRole,
  buildRbacTeamSnapshot,
  ROLES,
} from "./rbac.js";

assert.deepEqual([...permissionsForRole("master")].sort(), [
  "deploy.infra",
  "deploy.run",
  "integrations.read",
  "integrations.write",
  "logs.read",
  "mail.provision",
  "mail.read",
  "mail.send",
  "notices.write",
  "profile.write",
  "secrets.manage",
  "settings.read",
  "settings.write",
  "subscribers.write",
  "team.manage",
].sort());

assert.equal(roleHasPermission(permissionsForRole("viewer"), "deploy.run"), false);
assert.equal(roleHasPermission(permissionsForRole("admin"), "mail.send"), true);
assert.equal(roleHasPermission(permissionsForRole("operator"), "settings.write"), false);

const fakeEnv = { ADMIN_KV: null };
assert.equal(await resolveAdminRole(fakeEnv, "ops@lorapok.tech", false), "admin");
assert.equal(await resolveAdminRole(fakeEnv, "ops@lorapok.tech", true), "master");
assert.ok(ROLES.includes("viewer"));

const kvStore = new Map();
const kvEnv = {
  ADMIN_KV: {
    get: async (key) => kvStore.get(key) ?? null,
    put: async (key, value) => kvStore.set(key, value),
  },
};

await assignAdminRole(kvEnv, "ops@lorapok.tech", "operator");
assert.equal(await resolveAdminRole(kvEnv, "ops@lorapok.tech", false), "operator");
await removeAdminRole(kvEnv, "ops@lorapok.tech");
assert.equal(await resolveAdminRole(kvEnv, "ops@lorapok.tech", false), "admin");

const snapshot = await buildRbacTeamSnapshot({
  ...kvEnv,
  ADMIN_MASTER_EMAIL: "master@lorapok.tech",
  ADMIN_EMAILS: "ops@lorapok.tech",
});
assert.ok(snapshot.members.some((m) => m.email === "master@lorapok.tech" && m.role === "master"));

console.log("rbac.test.mjs: OK");
