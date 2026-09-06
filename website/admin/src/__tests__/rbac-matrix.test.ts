import { describe, expect, it } from "vitest";
import { hasPermission } from "../lib/rbac";

const ROLE_MATRIX: Record<string, string[]> = {
  admin: [
    "settings.read",
    "integrations.read",
    "integrations.write",
    "mail.read",
    "mail.send",
    "notices.write",
    "subscribers.write",
    "logs.read",
    "profile.write",
  ],
  operator: ["mail.read", "mail.send", "notices.write", "subscribers.write", "logs.read", "profile.write"],
  viewer: ["settings.read", "integrations.read", "mail.read", "logs.read", "profile.write"],
};

const ALL_PERMISSIONS = [
  "settings.read",
  "settings.write",
  "integrations.read",
  "integrations.write",
  "mail.read",
  "mail.send",
  "mail.provision",
  "team.manage",
  "secrets.manage",
  "deploy.run",
  "deploy.infra",
  "notices.write",
  "subscribers.write",
  "logs.read",
  "profile.write",
];

describe("client RBAC mirror (AUTH-01)", () => {
  it("master has every permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission([], permission, true)).toBe(true);
    }
  });

  for (const [role, allowed] of Object.entries(ROLE_MATRIX)) {
    it(`${role} matches AUTH-01 matrix`, () => {
      for (const permission of allowed) {
        expect(hasPermission(allowed, permission, false)).toBe(true);
      }
      for (const permission of ALL_PERMISSIONS) {
        if (!allowed.includes(permission)) {
          expect(hasPermission(allowed, permission, false)).toBe(false);
        }
      }
    });
  }
});
