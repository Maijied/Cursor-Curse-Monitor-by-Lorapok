import {
  MUTATING_ROUTE_PERMISSIONS,
  READ_ROUTE_PERMISSIONS,
} from "../../functions/api/_shared/rbac-routes.js";

/**
 * Resolve minimum permission for an API catalog route (AUTH-12 / AUTH-07).
 */
export function permissionForApiRoute(method: string, path: string): string | null {
  const normalizedPath = path.startsWith("/api") ? path.replace(/^\/api/, "") : path;
  const key = `${method.toUpperCase()} ${normalizedPath}`;
  const mutating = MUTATING_ROUTE_PERMISSIONS as Record<string, string>;
  const read = READ_ROUTE_PERMISSIONS as Record<string, string>;
  return mutating[key] ?? read[key] ?? null;
}

/** Whether the signed-in admin may run an API Explorer probe (AUTH-12). */
export function canProbeApiRoute(method: string, path: string, hasPermission: (p: string) => boolean): boolean {
  const perm = permissionForApiRoute(method, path);
  if (!perm) return true;
  return hasPermission(perm);
}
