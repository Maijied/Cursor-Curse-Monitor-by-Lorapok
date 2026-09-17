import { describe, expect, it } from "vitest";
import { fuzzyBest, fuzzyScore } from "./fuzzy-match";
import { buildCommandPaletteItems, rankCommandPaletteItems } from "./command-palette-catalog";
import { hasPermission } from "./rbac";
import { ROLE_PERMISSIONS } from "../../functions/api/_shared/rbac.js";

describe("fuzzy-match", () => {
  it("scores exact and substring matches", () => {
    expect(fuzzyScore("deploy", "Deployments")).toBeGreaterThan(400);
    expect(fuzzyScore("zzz", "Deployments")).toBe(0);
    expect(fuzzyBest("mail", ["Mailbox", "Settings → Mail"])).toBeGreaterThan(0);
  });
});

describe("command-palette-catalog", () => {
  it("filters navigation and settings by ACL (viewer)", () => {
    const perms = [...ROLE_PERMISSIONS.viewer];
    const has = (p: string) => hasPermission(perms, p, false);
    const items = buildCommandPaletteItems(has);
    expect(items.some((i) => i.id === "nav-/dashboard/deployments")).toBe(false);
    expect(items.some((i) => i.group === "Navigation" && i.label === "Overview")).toBe(true);
    expect(items.some((i) => i.id === "settings-cred-vault")).toBe(false);
    expect(items.some((i) => i.id === "nav-/dashboard/team")).toBe(false);
  });

  it("includes API + settings tabs for master", () => {
    const has = (p: string) => hasPermission(["*"], p, true);
    const items = buildCommandPaletteItems(has);
    expect(items.some((i) => i.group === "API")).toBe(true);
    expect(items.some((i) => i.id === "settings-discord")).toBe(true);
    expect(items.some((i) => i.group === "Docs")).toBe(true);
    expect(items.some((i) => i.group === "Tasks")).toBe(true);
  });

  it("ranks fuzzy query results", () => {
    const has = () => true;
    const items = buildCommandPaletteItems(has);
    const ranked = rankCommandPaletteItems(items, "discord");
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].label.toLowerCase()).toContain("discord");
  });
});
