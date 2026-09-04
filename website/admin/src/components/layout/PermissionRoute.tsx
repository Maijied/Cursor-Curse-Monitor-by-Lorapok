import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LarvaeLoaderPanel } from "../ui/LorapokLarvaeLoader";
import { useAuthSession } from "../../lib/auth-context";
import type { NavPermission } from "../../lib/nav-permissions";
import { canAccessFeature } from "../../lib/nav-permissions";

type PermissionRouteProps = {
  permission?: NavPermission;
  children: ReactNode;
};

/** Redirects to overview when the signed-in role lacks route permission. */
export default function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const { loading, hasPermission } = useAuthSession();

  if (loading) {
    return <LarvaeLoaderPanel label="Loading permissions…" className="min-h-64 border-0 bg-transparent" />;
  }

  if (!canAccessFeature(hasPermission, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
