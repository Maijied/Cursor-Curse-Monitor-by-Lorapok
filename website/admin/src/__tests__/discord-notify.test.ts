import { describe, it, expect } from "vitest";
import { buildDeploymentEmbed } from "../../functions/api/_shared/discord-notify.js";

describe("buildDeploymentEmbed", () => {
  it("formats a started deployment embed", () => {
    const embed = buildDeploymentEmbed({
      phase: "started",
      actionType: "publish-tag - Publish existing git tag to marketplaces",
      tag: "v0.7.2",
      channel: "Production",
      market: "Open VSX + Firefox AMO",
      triggeredBy: "admin@lorapok.tech",
      branch: "main",
      summary: "Deployment triggered successfully",
    });

    expect(embed.title).toBe("🚀 Deployment started");
    expect(embed.color).toBe(0x5865f2);
    expect(embed.fields.some((f) => f.name === "Version" && f.value === "`v0.7.2`")).toBe(true);
    expect(embed.fields.some((f) => f.name === "Action" && f.value === "Publish tag")).toBe(true);
    expect(embed.description).toBe("Deployment triggered successfully");
  });

  it("formats a successful completion embed with pipeline jobs", () => {
    const embed = buildDeploymentEmbed({
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
    });

    expect(embed.title).toBe("✅ Deployment succeeded");
    expect(embed.url).toBe("https://github.com/example/actions/runs/1");
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
