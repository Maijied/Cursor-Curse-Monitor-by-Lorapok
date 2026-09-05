import assert from "node:assert/strict";
import { PERMISSIONS } from "./rbac.js";
import { MUTATING_ROUTE_PERMISSIONS, READ_ROUTE_PERMISSIONS } from "./rbac-routes.js";

for (const perm of Object.values({ ...MUTATING_ROUTE_PERMISSIONS, ...READ_ROUTE_PERMISSIONS })) {
  assert.ok(PERMISSIONS.includes(perm), `unknown permission in route map: ${perm}`);
}

assert.equal(MUTATING_ROUTE_PERMISSIONS["POST /deploy"], "deploy.run");
assert.equal(MUTATING_ROUTE_PERMISSIONS["PUT /auth/rbac"], "team.manage");
assert.equal(READ_ROUTE_PERMISSIONS["GET /logs"], "logs.read");
assert.equal(READ_ROUTE_PERMISSIONS["GET /auth/acl-audit"], "logs.read");

console.log("rbac-routes.test.mjs: OK");
