import { logSystemEvent } from "./system-log.js";

export const ACL_AUDIT_SOURCE = "acl";

/**
 * @param {{
 *   action: string;
 *   target: string;
 *   previousRole?: string | null;
 *   newRole?: string | null;
 * }} params
 */
export function formatAclAuditMessage({ action, target, previousRole, newRole }) {
  switch (action) {
    case "allowlist.add":
      return `Added ${target} to admin allowlist (${newRole ?? "admin"})`;
    case "allowlist.remove":
      return `Removed ${target} from admin allowlist`;
    case "role.change":
      return `Changed role for ${target}: ${previousRole ?? "default"} → ${newRole ?? "admin"}`;
    case "role.assign":
      return `Assigned ${newRole ?? "admin"} role to ${target}`;
    case "role.clear":
      return `Cleared explicit role for ${target} (reverts to default admin)`;
    default:
      return `ACL ${action} for ${target}`;
  }
}

/**
 * @param {Record<string, unknown>} env
 * @param {{
 *   actor: string;
 *   action: string;
 *   target: string;
 *   previousRole?: string | null;
 *   newRole?: string | null;
 *   meta?: Record<string, unknown>;
 * }} entry
 */
export async function logAclAuditEvent(env, entry) {
  const actor = String(entry.actor ?? "").trim().toLowerCase();
  const target = String(entry.target ?? "").trim().toLowerCase();
  if (!actor || !target) return;

  const message = formatAclAuditMessage({
    action: entry.action,
    target,
    previousRole: entry.previousRole,
    newRole: entry.newRole,
  });

  await logSystemEvent(env, {
    level: "info",
    source: ACL_AUDIT_SOURCE,
    message,
    email: actor,
    meta: {
      event: entry.action,
      target,
      previousRole: entry.previousRole ?? null,
      newRole: entry.newRole ?? null,
      ...(entry.meta ?? {}),
    },
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; role: string; previousRole?: string | null }} params
 */
export async function logRoleAssignment(env, params) {
  const role = String(params.role ?? "").trim().toLowerCase();
  const previousRole = params.previousRole ? String(params.previousRole).trim().toLowerCase() : null;
  if (previousRole === role) return;

  const action = previousRole ? "role.change" : "role.assign";
  await logAclAuditEvent(env, {
    actor: params.actor,
    action,
    target: params.target,
    previousRole,
    newRole: role,
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; previousRole?: string | null }} params
 */
export async function logRoleClear(env, params) {
  await logAclAuditEvent(env, {
    actor: params.actor,
    action: "role.clear",
    target: params.target,
    previousRole: params.previousRole ?? null,
    newRole: "admin",
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; role: string }} params
 */
export async function logAllowlistAdd(env, params) {
  await logAclAuditEvent(env, {
    actor: params.actor,
    action: "allowlist.add",
    target: params.target,
    newRole: params.role,
  });
}

/**
 * @param {Record<string, unknown>} env
 * @param {{ actor: string; target: string; previousRole?: string | null }} params
 */
export async function logAllowlistRemove(env, params) {
  await logAclAuditEvent(env, {
    actor: params.actor,
    action: "allowlist.remove",
    target: params.target,
    previousRole: params.previousRole ?? null,
  });
}
