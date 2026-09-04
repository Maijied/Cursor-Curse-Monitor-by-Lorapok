import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { fetchAuthMe, type AuthMeResponse } from "./api";
import { hasPermission as checkPermission } from "./rbac";
import type { AdminRole } from "./rbac";

export type AuthSession = AuthMeResponse["user"] & {
  role: AdminRole;
};

type AuthContextValue = {
  user: User;
  session: AuthSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isMaster: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const value: AuthContextValue = {
    user,
    session,
    loading,
    refresh,
    isMaster,
    hasPermission: (permission) => checkPermission(permissions, permission, isMaster),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within AuthProvider");
  }
  return ctx;
}
