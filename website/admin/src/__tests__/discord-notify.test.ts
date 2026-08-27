import { describe, it, expect } from "vitest";
import {
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
      sampleEnrichment
    );

    expect(embed.title).toBe("🚀 Deployment started");
    expect(embed.color).toBe(0x5865f2);
    expect(embed.author).toMatchObject({ name: "Lorapok Mission Control" });
    expect(embed.fields.some((f) => f.name === "Version" && f.value === "`v0.7.2`")).toBe(true);
    expect(embed.fields.some((f) => f.name === "Action" && f.value === "Publish tag")).toBe(true);
    expect(String(embed.description)).toContain("Deployment triggered successfully");
  });

  it("formats a successful completion embed with pipeline jobs and banner image", () => {
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
      sampleEnrichment
    );

    expect(embed.title).toBe("✅ Deployment succeeded");
    expect(embed.url).toBe("https://github.com/example/actions/runs/1");
    expect(embed.image).toMatchObject({
      url: "https://cursor.lorapok.tech/assets/marketing/og-social-card.png",
    });
    const pipeline = embed.fields.find((f) => f.name === "Pipeline");
    expect(pipeline?.value).toContain("✅ **CI**");
    expect(pipeline?.value).toContain("⏭️ **Deploy Marketing Website**");
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
  it("returns primary plus supplemental embeds with breakdown and changelog", () => {
    const embeds = buildDeploymentEmbeds(
      {
        phase: "completed",
        conclusion: "success",
        actionType: "full-release",
        tag: "v1.0.31",
      },
      sampleEnrichment
    );

    expect(embeds.length).toBeGreaterThan(3);
    expect(embeds[0].title).toBe("✅ Deployment succeeded");
    expect(embeds.some((embed) => embed.title === "📦 Marketplace & release records")).toBe(true);
    expect(embeds.some((embed) => embed.title === "📊 Download breakdown")).toBe(true);
    expect(embeds.some((embed) => embed.title === "📝 Changelog")).toBe(true);
    expect(embeds.some((embed) => embed.title === "🔗 Quick links")).toBe(true);
  });

  it("skips supplemental embeds when enrichment is unavailable", () => {
    expect(buildSupplementalEmbeds({ phase: "started" }, null)).toEqual([]);
    expect(buildDeploymentEmbeds({ phase: "started" }, null)).toHaveLength(1);
  });
});
