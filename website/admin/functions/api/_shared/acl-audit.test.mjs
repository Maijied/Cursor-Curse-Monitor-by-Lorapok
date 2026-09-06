import assert from "node:assert/strict";
import {
  ACL_AUDIT_SOURCE,
  ACL_AUDIT_EVENTS,
  formatAclAuditMessage,
  normalizeAclAuditRow,
  filterAclAuditRows,
  aclAuditRowsToCsv,
} from "./acl-audit.js";

assert.equal(
  formatAclAuditMessage({ action: "role.change", target: "ops@lorapok.tech", previousRole: "viewer", newRole: "operator" }),
  "Changed role for ops@lorapok.tech: viewer → operator"
);

assert.equal(
  formatAclAuditMessage({ action: "allowlist.add", target: "new@lorapok.tech", newRole: "operator" }),
  "Added new@lorapok.tech to admin allowlist (operator)"
);

assert.equal(ACL_AUDIT_SOURCE, "acl");
assert.ok(ACL_AUDIT_EVENTS.includes("role.assign"));

const sampleRow = normalizeAclAuditRow({
  id: "1",
  ts: "2026-09-05T12:00:00.000Z",
  level: "info",
  email: "master@lorapok.tech",
  message: "Changed role for ops@lorapok.tech: viewer → operator",
  meta: {
    event: "role.change",
    target: "ops@lorapok.tech",
    previousRole: "viewer",
    newRole: "operator",
  },
});

assert.equal(sampleRow.event, "role.change");
assert.equal(sampleRow.actor, "master@lorapok.tech");
assert.equal(sampleRow.target, "ops@lorapok.tech");
assert.equal(sampleRow.previousRole, "viewer");
assert.equal(sampleRow.newRole, "operator");

const rows = [
  sampleRow,
  normalizeAclAuditRow({
    id: "2",
    ts: "2026-09-04T12:00:00.000Z",
    level: "info",
    email: "master@lorapok.tech",
    message: "Added new@lorapok.tech to admin allowlist (operator)",
    meta: { event: "allowlist.add", target: "new@lorapok.tech", newRole: "operator" },
  }),
];

const byEvent = filterAclAuditRows(rows, { event: "allowlist.add" });
assert.equal(byEvent.length, 1);
assert.equal(byEvent[0].target, "new@lorapok.tech");

const byActor = filterAclAuditRows(rows, { actor: "master" });
assert.equal(byActor.length, 2);

const bySince = filterAclAuditRows(rows, { since: "2026-09-05T00:00:00.000Z" });
assert.equal(bySince.length, 1);
assert.equal(bySince[0].id, "1");

const csv = aclAuditRowsToCsv(rows);
assert.ok(csv.startsWith("timestamp,event,actor,target,previous_role,new_role,message"));
assert.ok(csv.includes("role.change"));
assert.ok(csv.includes("Changed role for ops@lorapok.tech: viewer → operator"));

console.log("acl-audit.test.mjs: OK");
