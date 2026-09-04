import { describe, expect, it } from "vitest";
import { canAccessFeature, visibleSettingsTabs } from "../lib/nav-permissions";
import { hasPermission } from "../lib/rbac";

describe("nav-permissions", () => {
  const viewerPerms = ["settings.read", "integrations.read", "mail.read", "logs.read", "profile.write"];
  const viewerHas = (p: string) => hasPermission(viewerPerms, p, false);

  it("gates routes by permission", () => {
    expect(canAccessFeature(viewerHas, "settings.read")).toBe(true);
    expect(canAccessFeature(viewerHas, "deploy.run")).toBe(false);
    expect(canAccessFeature(viewerHas, "team.manage")).toBe(false);
  });

  it("filters settings tabs for viewer", () => {
    const tabs = visibleSettingsTabs(viewerHas);
    expect(tabs).toContain("general");
    expect(tabs).toContain("resend");
    expect(tabs).not.toContain("cred-vault");
  });

  it("hides settings from operator without settings.read", () => {
    const operatorPerms = ["mail.read", "mail.send", "notices.write", "subscribers.write", "logs.read", "profile.write"];
    const operatorHas = (p: string) => hasPermission(operatorPerms, p, false);
    expect(canAccessFeature(operatorHas, "settings.read")).toBe(false);
    expect(canAccessFeature(operatorHas, "mail.read")).toBe(true);
  });
});
