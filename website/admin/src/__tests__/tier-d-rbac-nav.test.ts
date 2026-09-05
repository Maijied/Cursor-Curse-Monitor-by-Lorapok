/**
 * SET-10 Tier D — RBAC nav + settings tab expectations (items 3–5).
 * Mirrors manual checklist when second Firebase accounts are unavailable.
 */
import { describe, expect, it } from "vitest";
import { APP_ROUTES } from "../routes";
import { canAccessFeature, visibleSettingsTabs } from "../lib/nav-permissions";
import { hasPermission, ROLE_LABELS, type AdminRole } from "../lib/rbac";
import { ROLE_PERMISSIONS } from "../../functions/api/_shared/rbac.js";

function navLabelsForRole(role: AdminRole, isMaster = role === "master") {
  const perms = [...(ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer)];
  const has = (p: string) => hasPermission(perms, p, isMaster);
  return APP_ROUTES.filter((route) => canAccessFeature(has, route.permission)).map((r) => r.label);
}

describe("SET-10 Tier D — viewer nav (checklist item 3)", () => {
  const labels = navLabelsForRole("viewer");

  it("shows Settings", () => {
    expect(labels).toContain("Settings");
  });

  it("hides Deployments", () => {
    expect(labels).not.toContain("Deployments");
  });

  it("hides Team Access", () => {
    expect(labels).not.toContain("Team Access");
  });

  it("hides Cred vault settings tab", () => {
    const perms = [...ROLE_PERMISSIONS.viewer];
    const has = (p: string) => hasPermission(perms, p, false);
    const tabs = visibleSettingsTabs(has);
    expect(tabs).not.toContain("cred-vault");
  });
});

describe("SET-10 Tier D — operator nav (checklist item 4)", () => {
  const perms = [...ROLE_PERMISSIONS.operator];
  const has = (p: string) => hasPermission(perms, p, false);
  const labels = navLabelsForRole("operator");

  it("shows Mailbox and Notices", () => {
    expect(labels).toContain("Mailbox");
    expect(labels).toContain("Notices");
  });

  it("hides Settings nav", () => {
    expect(labels).not.toContain("Settings");
    expect(canAccessFeature(has, "settings.read")).toBe(false);
  });
});

describe("SET-10 Tier D — master nav (checklist item 5)", () => {
  const labels = navLabelsForRole("master");

  it("shows Team Access", () => {
    expect(labels).toContain("Team Access");
  });

  it("shows Settings and Deployments", () => {
    expect(labels).toContain("Settings");
    expect(labels).toContain("Deployments");
  });

  it("includes Cred vault tab for master", () => {
    const has = (p: string) => hasPermission(["*"], p, true);
    const tabs = visibleSettingsTabs(has);
    expect(tabs).toContain("cred-vault");
  });
});

describe("SET-10 Tier D — role labels documented", () => {
  it("covers all assignable roles", () => {
    for (const role of ["viewer", "operator", "admin", "master"] as AdminRole[]) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});
