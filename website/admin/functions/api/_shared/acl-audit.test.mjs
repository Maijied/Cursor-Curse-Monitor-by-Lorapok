import assert from "node:assert/strict";
import { ACL_AUDIT_SOURCE, formatAclAuditMessage } from "./acl-audit.js";

assert.equal(
  formatAclAuditMessage({ action: "role.change", target: "ops@lorapok.tech", previousRole: "viewer", newRole: "operator" }),
  "Changed role for ops@lorapok.tech: viewer → operator"
);

assert.equal(
  formatAclAuditMessage({ action: "allowlist.add", target: "new@lorapok.tech", newRole: "operator" }),
  "Added new@lorapok.tech to admin allowlist (operator)"
);

assert.equal(ACL_AUDIT_SOURCE, "acl");

console.log("acl-audit.test.mjs: OK");
