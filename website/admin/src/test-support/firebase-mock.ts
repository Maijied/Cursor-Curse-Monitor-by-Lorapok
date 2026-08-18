import { vi } from "vitest";
import { getTestAdminEmail } from "./env";

export function createTestFirebaseAuthMock() {
  const email = getTestAdminEmail();
  const user = {
    email,
    getIdToken: vi.fn().mockResolvedValue("vitest-session-token"),
  };

  return {
    auth: {
      onAuthStateChanged: vi.fn((cb: (u: typeof user) => void) => {
        cb(user);
        return vi.fn();
      }),
      currentUser: user,
      signOut: vi.fn(),
    },
    db: {},
  };
}
