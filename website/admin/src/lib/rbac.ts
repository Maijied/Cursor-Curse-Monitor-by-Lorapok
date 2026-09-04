/** Client mirror of server RBAC (`functions/api/_shared/rbac.js`). Keep in sync. */

import type { NavPermission } from "./nav-permissions";

export type AdminRole = "master" | "admin" | "operator" | "viewer";

export const ROLE_LABELS: Record<AdminRole, string> = {
  master: "Master",
  admin: "Admin",
  operator: "Operator",
  viewer: "Viewer",
};

/** Roles assignable from Team / RBAC API (master is env-only). */
export const ASSIGNABLE_ROLES: Exclude<AdminRole, "master">[] = ["admin", "operator", "viewer"];

export function hasPermission(permissions: string[] | undefined, permission: string, isMaster?: boolean): boolean {
  if (isMaster) return true;
  if (!permissions?.length) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(permission);
}

export function hasAnyPermission(
  permissions: string[] | undefined,
  required: NavPermission,
  isMaster?: boolean
): boolean {
  if (isMaster) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((p) => hasPermission(permissions, p, false));
}
