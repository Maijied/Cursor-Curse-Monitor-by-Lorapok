import { vi } from "vitest";
import type { ReactNode } from "react";

/** Vitest mock for components that call useAuthSession outside AuthGuard. */
export function mockAuthSessionModule() {
  return {
    useAuthSession: () => ({
      user: { email: "test@lorapok.test", uid: "vitest-auth-uid" },
      session: {
        email: "test@lorapok.test",
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
