import { describe, it, expect } from "vitest";
import {
  appendEnrichmentFields,
  appendEnrichmentSections,
  buildCompactMarketplaceSummary,
  buildCompactStatsBlock,
  buildDeploymentEmbed,
  buildDeploymentEmbeds,
  buildSupplementalEmbeds,
} from "../../functions/api/_shared/discord-notify.js";

const sampleEnrichment = {
  brand: {
    icon: "https://cursor.lorapok.tech/assets/marketing/icon-128.png",
    banner: "https://cursor.lorapok.tech/assets/marketing/og-social-card.png",
  },
  marketplaceFields: [{ name: "Package", value: "`1.0.26` ✅", inline: true }],
  downloadBreakdown: "```\nTotal ········· 9,975\n```",
  engagement: "```\nVisits ······· 128\n```",
  changelog: "### Added\n- Rich Discord deployment embeds",
  quickLinks: "[Product site](https://cursor.lorapok.tech)",
};

describe("buildDeploymentEmbed", () => {
  it("formats a started deployment embed with author branding", () => {
    const embed = buildDeploymentEmbed(
      {
        phase: "started",
        actionType: "publish-tag - Publish existing git tag to marketplaces",
        tag: "v0.7.2",
        channel: "Production",
        market: "Open VSX + Firefox AMO",
        triggeredBy: "admin@lorapok.tech",
        branch: "main",
        summary: "Deployment triggered successfully",
      },
      sampleEnrichment,
    );

    expect(embed.title).toBe("🚀 Deployment started");
    expect(embed.color).toBe(0x5865f2);
    expect(embed.author).toMatchObject({ name: "Lorapok Mission Control" });
    expect(embed.fields.some((f) => f.name === "Version" && f.value === "`v0.7.2`")).toBe(true);
    expect(embed.fields.some((f) => f.name === "Action" && f.value === "Publish tag")).toBe(true);
    expect(String(embed.description)).toContain("Deployment triggered successfully");
    expect(String(embed.description)).not.toContain("Release sync");
  });

  it("formats a successful completion embed with pipeline jobs in the description", () => {
    const embed = buildDeploymentEmbed(
      {
        phase: "completed",
        conclusion: "success",
        actionType: "full-release",
        tag: "v0.8.0",
        runUrl: "https://github.com/example/actions/runs/1",
        jobs: [
          { name: "CI", conclusion: "success" },
          { name: "Deploy to Marketplaces", conclusion: "success" },
          { name: "Deploy Marketing Website", conclusion: "skipped" },
        ],
        duration: "4m 12s",
      },
      sampleEnrichment,
    );

    expect(embed.title).toBe("✅ Deployment succeeded");
    expect(embed.url).toBe("https://github.com/example/actions/runs/1");
    expect(embed.image).toBeUndefined();
    expect(String(embed.description)).toContain("**Pipeline**");
    expect(String(embed.description)).toContain("✅ **CI**");
    expect(String(embed.description)).toContain("⏭️ **Deploy Marketing Website**");
  });

  it("formats a failure embed", () => {
    const embed = buildDeploymentEmbed({
      phase: "completed",
      conclusion: "failure",
      actionType: "rollback",
      tag: "v0.7.1",
    });

    expect(embed.title).toBe("❌ Deployment failed");
    expect(embed.color).toBe(0xed4245);
  });
});

describe("buildDeploymentEmbeds", () => {
  it("returns exactly one Discord embed with all enrichment in the description", () => {
    const embeds = buildDeploymentEmbeds(
      {
        phase: "completed",
        conclusion: "success",
        actionType: "full-release",
        tag: "v1.0.31",
      },
      sampleEnrichment,
    );

    expect(embeds).toHaveLength(1);
    const description = String(embeds[0].description);
    expect(embeds[0].title).toBe("✅ Deployment succeeded");
    expect(description).toContain("**Release sync**");
    expect(description).toContain("**Reach & engagement**");
    expect(description).toContain("**What's new**");
    expect(description).toContain("**Links**");
    expect(embeds[0].fields?.some((field) => field.name === "📦 Release sync")).toBe(false);
  });

  it("skips enrichment sections when enrichment is unavailable", () => {
    expect(buildSupplementalEmbeds({ phase: "started" }, null)).toEqual([]);
    expect(buildDeploymentEmbeds({ phase: "started" }, null)).toHaveLength(1);
    expect(buildDeploymentEmbeds({ phase: "completed", conclusion: "success" }, null)[0].fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Action" })]),
    );
  });
});

describe("compact enrichment formatters", () => {
  it("builds a compact marketplace summary from field rows", () => {
    const summary = buildCompactMarketplaceSummary({
      marketplaceFields: [
        { name: "Package", value: "`1.0.26` ✅" },
        { name: "GitHub release", value: "`v1.0.31` ⚠️" },
        { name: "Sync status", value: "ahead" },
        { name: "Open VSX", value: "`1.0.29` ⚠️" },
        { name: "Open VSX duplicate", value: "`1.0.29` ⚠️" },
        { name: "VS Code Marketplace", value: "`1.0.29` ⚠️" },
        { name: "Firefox AMO", value: "pending AMO ⚠️" },
        { name: "Release status", value: "candidate" },
        { name: "Published version", value: "`1.0.31`" },
      ],
    });

    expect(summary).toContain("Package `1.0.26` ✅");
    expect(summary).toContain("Open VSX `1.0.29` ⚠️");
    expect(summary).toContain("Firefox pending AMO ⚠️");
  });

  it("merges download and engagement blocks into one stats field", () => {
    const stats = buildCompactStatsBlock(sampleEnrichment);
    expect(stats).toContain("Total ········· 9,975");
    expect(stats).toContain("Visits ······· 128");
  });

  it("appendEnrichmentSections adds compact sections to the description body", () => {
    const sections = ["Brand line"];
    appendEnrichmentSections(
      sections,
      {
        phase: "completed",
        conclusion: "success",
        jobs: [{ name: "Deploy Admin Panel", conclusion: "success" }],
      },
      sampleEnrichment,
    );
    expect(sections.join("\n")).toContain("**Pipeline**");
    expect(sections.join("\n")).toContain("**Release sync**");
    expect(sections.join("\n")).toContain("**Reach & engagement**");
    expect(sections.join("\n")).toContain("**What's new**");
    expect(sections.join("\n")).toContain("**Links**");
  });

  it("appendEnrichmentFields remains compatible for legacy callers", () => {
    const fields = [{ name: "Action", value: "Full release", inline: true }];
    appendEnrichmentFields(fields, { phase: "completed", conclusion: "success" }, sampleEnrichment);
    expect(fields.length).toBeGreaterThan(1);
  });
});
