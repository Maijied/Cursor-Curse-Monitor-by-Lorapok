import { describe, expect, it } from "vitest";
import { UI_FEATURE_PERMISSIONS } from "../lib/feature-permissions";
import { permissionForApiRoute, canProbeApiRoute } from "../lib/api-permissions";
import { hasPermission } from "../lib/rbac";

describe("AUTH-12 feature ACL", () => {
  it("maps UI features to known permissions", () => {
    expect(UI_FEATURE_PERMISSIONS["mailbox.compose"]).toBe("mail.send");
    expect(UI_FEATURE_PERMISSIONS["team.invite"]).toBe("team.manage");
  });

  it("viewer cannot send mail or manage team", () => {
    const viewer = ["settings.read", "integrations.read", "mail.read", "logs.read", "profile.write"];
    expect(hasPermission(viewer, "mail.send", false)).toBe(false);
    expect(hasPermission(viewer, "team.manage", false)).toBe(false);
    expect(hasPermission(viewer, "mail.read", false)).toBe(true);
  });

  it("operator can send mail but not deploy", () => {
    const operator = ["mail.read", "mail.send", "notices.write", "subscribers.write", "logs.read", "profile.write"];
    expect(hasPermission(operator, "mail.send", false)).toBe(true);
    expect(hasPermission(operator, "deploy.run", false)).toBe(false);
  });

  it("resolves API catalog permissions from rbac-routes", () => {
    expect(permissionForApiRoute("POST", "/deploy")).toBe("deploy.run");
    expect(permissionForApiRoute("POST", "/mailbox")).toBe("mail.send");
    expect(permissionForApiRoute("PUT", "/auth/rbac")).toBe("team.manage");
    expect(permissionForApiRoute("GET", "/logs")).toBe("logs.read");
  });

  it("blocks API Explorer probes when permission is missing", () => {
    const viewer = (p: string) => hasPermission(["logs.read"], p, false);
    expect(canProbeApiRoute("POST", "/mailbox", viewer)).toBe(false);
    expect(canProbeApiRoute("GET", "/logs", viewer)).toBe(true);
    expect(canProbeApiRoute("GET", "/health", viewer)).toBe(true);
  });
});
