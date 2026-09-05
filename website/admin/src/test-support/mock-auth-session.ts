import { vi } from "vitest";
import type { ReactNode } from "react";
import { getTestAdminEmail } from "./env";

/** Vitest mock for components that call useAuthSession outside AuthGuard. */
export function mockAuthSessionModule() {
  const email = getTestAdminEmail();
  return {
    useAuthSession: () => ({
      user: { email, uid: "vitest-auth-uid" },
      session: {
        email,
        role: "master" as const,
        isMaster: true,
        permissions: [],
      },
      loading: false,
      refresh: vi.fn(async () => {}),
      hasPermission: () => true,
      isMaster: true,
    }),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
  };
}
