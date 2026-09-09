import { createContext, useContext } from "react";
import type { User } from "firebase/auth";
import type { AuthMeResponse } from "./api";
import type { AdminRole } from "./rbac";

export type AuthSession = AuthMeResponse["user"] & {
  role: AdminRole;
};

export type AuthContextValue = {
  user: User;
  session: AuthSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isMaster: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within AuthProvider");
  }
  return ctx;
}
