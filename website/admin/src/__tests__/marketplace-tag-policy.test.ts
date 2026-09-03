import { describe, expect, it } from "vitest";
import {
  hasCiOnlySuffix,
  isMarketplaceSemverTag,
  isValidMarketplaceTag,
  validateMarketplaceDeploy,
} from "../../functions/api/_shared/marketplace-tag-policy.js";

describe("marketplace-tag-policy", () => {
  it("accepts semver and rollback tags at or above v0.5.5", () => {
    expect(isValidMarketplaceTag("v0.5.5")).toBe(true);
    expect(isValidMarketplaceTag("v1.0.51")).toBe(true);
    expect(isValidMarketplaceTag("v1.0.R2")).toBe(true);
  });

  it("rejects CI-only and semver-pre-release tag shapes", () => {
    expect(hasCiOnlySuffix("v1.0.34-dev.5")).toBe(true);
    expect(hasCiOnlySuffix("v1.0.34-pr.12")).toBe(true);
    expect(hasCiOnlySuffix("v1.0.34-beta.0")).toBe(true);
    expect(isValidMarketplaceTag("v1.0.34-dev.5")).toBe(false);
    expect(isValidMarketplaceTag("v1.0.34-beta.0")).toBe(false);
    expect(isMarketplaceSemverTag("v1.0.34-beta.0")).toBe(false);
  });

  it("allows beta channel for any publish market (CI may skip AMO on pre-release)", () => {
    expect(
      validateMarketplaceDeploy({
        targetTag: "v1.0.51",
        releaseChannel: "Beta (Pre-release)",
        publishMarket: "Open VSX + Firefox AMO",
      }).ok
    ).toBe(true);
    expect(
      validateMarketplaceDeploy({
        targetTag: "v1.0.51",
        releaseChannel: "Beta (Pre-release)",
        publishMarket: "Both",
      }).ok
    ).toBe(true);
    expect(
      validateMarketplaceDeploy({
        targetTag: "v1.0.51",
        releaseChannel: "Beta (Pre-release)",
        publishMarket: "VS Code Marketplace",
      }).ok
    ).toBe(true);
    expect(
      validateMarketplaceDeploy({
        targetTag: "v1.0.51",
        releaseChannel: "Beta (Pre-release)",
        publishMarket: "Open VSX",
      }).ok
    ).toBe(true);
  });
});
