import { useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { fetchAuthMe } from "./api";
import { hasPermission as checkPermission } from "./rbac";
import type { AdminRole } from "./rbac";
import { AuthContext, type AuthSession } from "./use-auth-session";

export function AuthProvider({ user, children }: { user: User; children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const data = await fetchAuthMe();
    setSession({
      ...data.user,
      role: data.user.role as AdminRole,
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refresh()
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.uid]);

  const isMaster = Boolean(session?.isMaster);
  const permissions = session?.permissions ?? [];

  const value = {
    user,
    session,
    loading,
    refresh,
    isMaster,
    hasPermission: (permission: string) => checkPermission(permissions, permission, isMaster),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
